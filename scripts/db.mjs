import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
/** Small local D1-compatible adapter. Production uses Cloudflare D1, not this file. */
export function localDatabase(filename = ':memory:') {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys=ON');
  db.exec(fs.readFileSync(path.resolve(import.meta.dirname, '../migrations/0001_initial.sql'), 'utf8'));
  function statement(sql, args = []) {
    return {
      sql, args,
      bind(...values) { return statement(sql, values); },
      async first(column) { const value = db.prepare(sql).get(...args); return value ? column ? value[column] : { ...value } : null; },
      async all() { return { results: db.prepare(sql).all(...args).map(row => ({ ...row })), success: true }; },
      async run() { const result = db.prepare(sql).run(...args); return { success: true, meta: { changes: Number(result.changes) } }; }
    };
  }
  return {
    prepare: sql => statement(sql),
    async batch(statements) {
      db.exec('BEGIN');
      try { const result = statements.map(s => { const result = db.prepare(s.sql).run(...s.args); return { success: true, meta: { changes: Number(result.changes) } }; }); db.exec('COMMIT'); return result; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    close: () => db.close()
  };
}
