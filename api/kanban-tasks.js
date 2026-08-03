import { createClient } from '@supabase/supabase-js';
import { hasValidAdminSession } from '../server/api-utils/adminSession.js';

const TABLE = 'kanban_tasks';

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function getServiceClient() {
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function readJsonBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve(null);
      }
    });
  });
}

function normalizeTask(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    assignee: row.assignee,
    category: row.category,
    planHours: row.plan_hours,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export default async function handler(req, res) {
  const client = getServiceClient();
  if (!client) {
    return json(res, 501, {
      ok: false,
      status: 'disabled',
      message: 'Supabase service role is not configured on the server.',
    });
  }

  const method = req.method;

  if (method === 'GET') {
    try {
      const { data, error } = await client
        .from(TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      const normalized = (data || []).map(normalizeTask);
      return json(res, 200, {
        ok: true,
        status: 'ok',
        data: normalized,
      });
    } catch (err) {
      return json(res, 500, {
        ok: false,
        status: 'error',
        message: err.message || 'Failed to list kanban tasks.',
      });
    }
  }

  if (method === 'POST') {
    try {
      const body = await readJsonBody(req);
      if (!body) {
        return json(res, 400, { ok: false, status: 'error', message: 'Invalid JSON body.' });
      }

      const { error, data } = await client
        .from(TABLE)
        .insert({
          title: body.title || '새 업무 카드',
          status: body.status || 'todo',
          assignee: body.assignee || 'unassigned',
          category: body.category || 'other',
          plan_hours: Number(body.planHours) || 0,
          notes: body.notes || '',
        })
        .select()
        .single();

      if (error) throw new Error(error.message);

      return json(res, 200, {
        ok: true,
        status: 'ok',
        data: normalizeTask(data),
      });
    } catch (err) {
      return json(res, 500, {
        ok: false,
        status: 'error',
        message: err.message || 'Failed to create kanban task.',
      });
    }
  }

  if (method === 'PUT') {
    try {
      const body = await readJsonBody(req);
      if (!body || !body.id) {
        return json(res, 400, { ok: false, status: 'error', message: 'Invalid JSON body or missing task ID.' });
      }

      const { data: existing, error: loadError } = await client
        .from(TABLE)
        .select('*')
        .eq('id', body.id)
        .maybeSingle();

      if (loadError) throw new Error(loadError.message);
      if (!existing) {
        return json(res, 404, { ok: false, status: 'not_found', message: 'Task not found.' });
      }

      const payload = {};
      if (body.title !== undefined) payload.title = body.title;
      if (body.status !== undefined) payload.status = body.status;
      if (body.assignee !== undefined) payload.assignee = body.assignee;
      if (body.category !== undefined) payload.category = body.category;
      if (body.planHours !== undefined) payload.plan_hours = Number(body.planHours) || 0;
      if (body.notes !== undefined) payload.notes = body.notes;
      payload.updated_at = new Date().toISOString();

      const { error: updateError, data: updated } = await client
        .from(TABLE)
        .update(payload)
        .eq('id', body.id)
        .select()
        .single();

      if (updateError) throw new Error(updateError.message);

      return json(res, 200, {
        ok: true,
        status: 'ok',
        data: normalizeTask(updated),
      });
    } catch (err) {
      return json(res, 500, {
        ok: false,
        status: 'error',
        message: err.message || 'Failed to update kanban task.',
      });
    }
  }

  if (method === 'DELETE') {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const id = url.searchParams.get('id');
    const clearAll = url.searchParams.get('clear') === 'true';
    const isReset = url.searchParams.get('reset') === 'true';

    try {
      if (clearAll || isReset) {
        if (!hasValidAdminSession(req)) {
          return json(res, 403, {
            ok: false,
            status: 'forbidden',
            message: '관리자 권한이 필요합니다.',
          });
        }

        const { error: delError } = await client
          .from(TABLE)
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (delError) throw new Error(delError.message);

        if (isReset) {
          const now = new Date().toISOString();
          const mockTasks = [
            {
              title: '신규 입사자 온보딩 교육 교재 개선',
              status: 'todo',
              assignee: 'A',
              category: 'edu',
              plan_hours: 8,
              notes: '온보딩 피드백을 분석하여 가독성이 떨어지는 파트를 전면 수정합니다.',
              created_at: now,
              updated_at: now,
            },
            {
              title: 'PPT 아카데마이저 템플릿 개발 및 동기화',
              status: 'in_progress',
              assignee: 'A',
              category: 'ai',
              plan_hours: 6,
              notes: '보고서 작성 효율을 극대화하기 위한 신규 레이아웃 템플릿 3종 추가.',
              created_at: now,
              updated_at: now,
            },
            {
              title: '팀 KPI v2 운영 모델 가이드 작성',
              status: 'done',
              assignee: 'unassigned',
              category: 'prep',
              plan_hours: 4,
              notes: 'OKESTRO 교육팀 상반기 운영 모델에 관한 매뉴얼 정리 완료.',
              created_at: now,
              updated_at: now,
            }
          ];
          const { error: insError } = await client.from(TABLE).insert(mockTasks);
          if (insError) throw new Error(insError.message);
        }

        return json(res, 200, {
          ok: true,
          status: 'ok',
          message: isReset ? 'Kanban tasks reset to default sample.' : 'All kanban tasks cleared.',
        });
      }

      if (!id) {
        return json(res, 400, { ok: false, status: 'error', message: 'Missing task ID query parameter.' });
      }

      const { error: delError } = await client
        .from(TABLE)
        .delete()
        .eq('id', id);

      if (delError) throw new Error(delError.message);

      return json(res, 200, {
        ok: true,
        status: 'ok',
        message: 'Task deleted.',
      });
    } catch (err) {
      return json(res, 500, {
        ok: false,
        status: 'error',
        message: err.message || 'Failed to delete kanban task.',
      });
    }
  }

  res.setHeader('Allow', 'GET, POST, PUT, DELETE');
  return json(res, 405, { error: 'method not allowed' });
}
