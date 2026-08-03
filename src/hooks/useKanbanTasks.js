import { useState, useEffect, useCallback } from 'react';

const KANBAN_STORAGE_KEY = 'tms-kanban-tasks-v1';

const DEFAULT_KANBAN_TASKS = [
  {
    id: 'k-1',
    title: '신규 입사자 온보딩 교육 교재 개선',
    status: 'todo',
    assignee: 'A',
    category: 'edu',
    planHours: 8,
    notes: '온보딩 피드백을 분석하여 가독성이 떨어지는 파트를 전면 수정합니다.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'k-2',
    title: 'PPT 아카데마이저 템플릿 개발 및 동기화',
    status: 'in_progress',
    assignee: 'A',
    category: 'ai',
    planHours: 6,
    notes: '보고서 작성 효율을 극대화하기 위한 신규 레이아웃 템플릿 3종 추가.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'k-3',
    title: '팀 KPI v2 운영 모델 가이드 작성',
    status: 'done',
    assignee: 'unassigned',
    category: 'prep',
    planHours: 4,
    notes: 'OKESTRO 교육팀 상반기 운영 모델에 관한 매뉴얼 정리 완료.',
    createdAt: new Date().toISOString(),
  }
];

function loadKanbanTasks() {
  try {
    const raw = localStorage.getItem(KANBAN_STORAGE_KEY);
    if (!raw) return DEFAULT_KANBAN_TASKS;
    return JSON.parse(raw);
  } catch {
    return DEFAULT_KANBAN_TASKS;
  }
}

export function useKanbanTasks() {
  const [tasks, setTasks] = useState(loadKanbanTasks);
  const [loading, setLoading] = useState(false);

  // Fetch tasks from Supabase API on mount
  useEffect(() => {
    let active = true;
    const fetchTasks = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/kanban-tasks');
        if (!res.ok) throw new Error('Failed to fetch tasks from server');
        const payload = await res.json();
        if (payload.ok && Array.isArray(payload.data)) {
          if (active) {
            setTasks(payload.data);
            localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(payload.data));
          }
        }
      } catch (err) {
        console.error('Failed to load kanban tasks from API, using localStorage cache:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchTasks();
    return () => {
      active = false;
    };
  }, []);

  // Synchronize state across multiple browser tabs in real-time
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === KANBAN_STORAGE_KEY) {
        try {
          const nextTasks = e.newValue ? JSON.parse(e.newValue) : [];
          setTasks(nextTasks);
        } catch {
          // ignore parsing errors
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const addTask = useCallback(async (taskData) => {
    const tempId = `temp-${Date.now()}`;
    const tempTask = {
      id: tempId,
      title: taskData.title?.trim() || '새 업무 카드',
      status: taskData.status || 'todo',
      assignee: taskData.assignee || 'unassigned',
      category: taskData.category || 'other',
      planHours: Number(taskData.planHours) || 0,
      notes: taskData.notes || '',
      createdAt: new Date().toISOString(),
    };

    // Optimistic update
    setTasks((prev) => [tempTask, ...prev]);

    try {
      const res = await fetch('/api/kanban-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });
      if (!res.ok) throw new Error('API error creating task');
      const payload = await res.json();
      if (payload.ok && payload.data) {
        setTasks((prev) => {
          const next = prev.map((t) => (t.id === tempId ? payload.data : t));
          localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
        return payload.data;
      }
    } catch (err) {
      console.error('Failed to create task on server:', err);
      // Revert optimistic update
      setTasks((prev) => {
        const next = prev.filter((t) => t.id !== tempId);
        localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    }
  }, []);

  const updateTask = useCallback(async (id, patch) => {
    let originalTasks = [];
    setTasks((prev) => {
      originalTasks = prev;
      const next = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    try {
      const res = await fetch('/api/kanban-tasks', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!res.ok) throw new Error('API error updating task');
      const payload = await res.json();
      if (payload.ok && payload.data) {
        setTasks((prev) => {
          const next = prev.map((t) => (t.id === id ? payload.data : t));
          localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(next));
          return next;
        });
      }
    } catch (err) {
      console.error('Failed to update task on server:', err);
      // Revert optimistic update
      setTasks(() => {
        localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(originalTasks));
        return originalTasks;
      });
    }
  }, []);

  const deleteTask = useCallback(async (id) => {
    let originalTasks = [];
    setTasks((prev) => {
      originalTasks = prev;
      const next = prev.filter((t) => t.id !== id);
      localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    try {
      const res = await fetch(`/api/kanban-tasks?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('API error deleting task');
    } catch (err) {
      console.error('Failed to delete task on server:', err);
      // Revert optimistic update
      setTasks(() => {
        localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(originalTasks));
        return originalTasks;
      });
    }
  }, []);

  const moveTask = useCallback(async (id, newStatus) => {
    await updateTask(id, { status: newStatus });
  }, [updateTask]);

  const resetTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/kanban-tasks?reset=true', {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('API error resetting tasks');
      const payload = await res.json();
      if (payload.ok) {
        // Fetch fresh seeded tasks with database IDs
        const fresh = await fetch('/api/kanban-tasks');
        const freshPayload = await fresh.json();
        if (freshPayload.ok && Array.isArray(freshPayload.data)) {
          setTasks(freshPayload.data);
          localStorage.setItem(KANBAN_STORAGE_KEY, JSON.stringify(freshPayload.data));
        }
      }
    } catch (err) {
      console.error('Failed to reset tasks on server:', err);
    }
  }, []);

  const clearTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/kanban-tasks?clear=true', {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('API error clearing tasks');
      const payload = await res.json();
      if (payload.ok) {
        setTasks([]);
        localStorage.setItem(KANBAN_STORAGE_KEY, '[]');
      }
    } catch (err) {
      console.error('Failed to clear tasks on server:', err);
    }
  }, []);

  return {
    tasks,
    loading,
    addTask,
    updateTask,
    deleteTask,
    moveTask,
    resetTasks,
    clearTasks,
  };
}
