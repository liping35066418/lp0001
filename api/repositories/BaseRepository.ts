import type Database from 'better-sqlite3';
import { getDb } from '../utils/db.js';

export interface Pagination {
  page?: number;
  pageSize?: number;
  orderBy?: string;
  orderDir?: 'asc' | 'desc';
}

export class BaseRepository<T extends Record<string, unknown>> {
  protected db: Database.Database;
  protected tableName: string;
  protected columns: string[];

  constructor(tableName: string, columns: string[]) {
    this.db = getDb();
    this.tableName = tableName;
    this.columns = columns;
  }

  protected toSnakeCase(cols: string[]): string[] {
    return cols;
  }

  findById(id: number): T | null {
    const row = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE id = ?`).get(id) as T | undefined;
    return row ?? null;
  }

  findAll(options: Pagination = {}): { list: T[]; total: number } {
    const { page = 1, pageSize = 50, orderBy = 'id', orderDir = 'desc' } = options;
    const safeOrder = this.columns.includes(orderBy) ? orderBy : 'id';
    const safeDir = orderDir.toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const offset = (page - 1) * pageSize;
    const list = this.db.prepare(
      `SELECT * FROM ${this.tableName} ORDER BY ${safeOrder} ${safeDir} LIMIT ? OFFSET ?`
    ).all(pageSize, offset) as T[];
    const total = (this.db.prepare(`SELECT COUNT(*) as c FROM ${this.tableName}`).get() as { c: number }).c;
    return { list, total };
  }

  findBy<K extends keyof T>(key: K, value: T[K]): T[] {
    const col = String(key);
    if (!this.columns.includes(col) && col !== 'id') throw new Error('invalid column');
    return this.db.prepare(`SELECT * FROM ${this.tableName} WHERE ${col} = ? ORDER BY id DESC`).all(value) as T[];
  }

  findOneBy<K extends keyof T>(key: K, value: T[K]): T | null {
    const list = this.findBy(key, value);
    return list[0] ?? null;
  }

  create(data: Partial<T>): number {
    const keys = Object.keys(data).filter(k => this.columns.includes(k));
    const placeholders = keys.map(() => '?').join(',');
    const stmt = this.db.prepare(`INSERT INTO ${this.tableName} (${keys.join(',')}) VALUES (${placeholders})`);
    const values = keys.map(k => (data as Record<string, unknown>)[k]);
    const info = stmt.run(...values);
    return Number(info.lastInsertRowid);
  }

  update(id: number, data: Partial<T>): boolean {
    const keys = Object.keys(data).filter(k => this.columns.includes(k) && k !== 'id');
    if (keys.length === 0) return false;
    const sets = keys.map(k => `${k} = ?`).join(',');
    const values = keys.map(k => (data as Record<string, unknown>)[k]);
    const info = this.db.prepare(`UPDATE ${this.tableName} SET ${sets} WHERE id = ?`).run(...values, id);
    return info.changes > 0;
  }

  delete(id: number): boolean {
    const info = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`).run(id);
    return info.changes > 0;
  }

  count(where = '1=1', params: unknown[] = []): number {
    const row = this.db.prepare(`SELECT COUNT(*) as c FROM ${this.tableName} WHERE ${where}`).get(...params) as { c: number };
    return row.c;
  }

  query(sql: string, params: unknown[] = []): unknown[] {
    return this.db.prepare(sql).all(...params);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  transaction<U>(fn: () => U): U {
    return this.db.transaction(fn)();
  }
}
