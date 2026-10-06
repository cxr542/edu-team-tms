/**
 * Minimal in-memory stand-in for the supabase-js query builder (only what the ledger
 * server code uses). update() mimics ledger_bump_version(): version/updated_at are bumped
 * unless only `balance` changed.
 */
export function makeFakeSupabase(seed = {}) {
  const tables = {
    ledger_transactions: [],
    ledger_categories: [],
    ledger_settings: [],
    admin_login_attempts: [],
    ...seed,
  };
  const pk = { ledger_transactions: 'id', ledger_categories: 'id', ledger_settings: 'key' };
  const log = [];

  function builder(name) {
    const st = { op: 'select', filters: [], orders: [], limit: null, payload: null, opts: null };
    const q = {
      select: () => q,
      insert: (p) => ((st.op = 'insert'), (st.payload = p), q),
      update: (p) => ((st.op = 'update'), (st.payload = p), q),
      delete: () => ((st.op = 'delete'), q),
      upsert: (p, o) => ((st.op = 'upsert'), (st.payload = p), (st.opts = o), q),
      eq: (c, v) => (st.filters.push((r) => r[c] === v), q),
      in: (c, vs) => (st.filters.push((r) => vs.includes(r[c])), q),
      gte: (c, v) => (st.filters.push((r) => r[c] >= v), q),
      lt: (c, v) => (st.filters.push((r) => r[c] < v), q),
      order: (c, { ascending = true } = {}) => (st.orders.push([c, ascending]), q),
      limit: (n) => ((st.limit = n), q),
      then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
    };

    function matching() {
      return tables[name].filter((r) => st.filters.every((f) => f(r)));
    }

    function run() {
      log.push({ table: name, op: st.op, payload: st.payload });
      const rows = tables[name];
      if (st.op === 'select') {
        let out = matching().map((r) => ({ ...r }));
        for (const [c, asc] of [...st.orders].reverse()) {
          out.sort((a, b) => (a[c] < b[c] ? -1 : a[c] > b[c] ? 1 : 0) * (asc ? 1 : -1));
        }
        if (st.limit != null) out = out.slice(0, st.limit);
        return { data: out, error: null };
      }
      if (st.op === 'insert') {
        const list = Array.isArray(st.payload) ? st.payload : [st.payload];
        for (const p of list) {
          if (rows.some((r) => r[pk[name]] === p[pk[name]])) {
            return { data: null, error: { code: '23505', message: 'duplicate key' } };
          }
        }
        const added = list.map((p) => ({ version: 1, updated_at: 'now', ...p }));
        rows.push(...added);
        return { data: added.map((r) => ({ ...r })), error: null };
      }
      if (st.op === 'update') {
        const hit = matching();
        for (const r of hit) {
          const before = { ...r };
          Object.assign(r, st.payload);
          const strip = ({ balance, version, updated_at, ...rest }) => JSON.stringify(rest);
          if (name === 'ledger_transactions' && strip(before) === strip(r)) {
            r.version = before.version;
          } else if (r.version !== undefined) {
            r.version = before.version + 1;
          }
        }
        return { data: hit.map((r) => ({ ...r })), error: null };
      }
      if (st.op === 'delete') {
        const hit = matching();
        tables[name] = rows.filter((r) => !hit.includes(r));
        return { data: hit.map((r) => ({ ...r })), error: null };
      }
      if (st.op === 'upsert') {
        const key = st.opts?.onConflict || pk[name];
        for (const p of st.payload) {
          const cur = rows.find((r) => r[key] === p[key]);
          if (cur) Object.assign(cur, p);
          else rows.push({ version: 1, ...p });
        }
        return { data: st.payload.map((p) => ({ ...p })), error: null };
      }
      return { data: null, error: { message: 'unsupported' } };
    }
    return q;
  }

  return { from: builder, tables, log };
}
