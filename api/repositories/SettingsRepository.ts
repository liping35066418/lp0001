import { BaseRepository } from './BaseRepository.js';

export interface Settings { [key: string]: unknown;
  key: string;
  value: string;
}

const TABLE_NAME = 'settings';
const COLUMNS = ['key', 'value'];

export class SettingsRepository extends BaseRepository<Settings> {
  constructor() {
    super(TABLE_NAME, COLUMNS);
  }

  get(key: string): string | null {
    const row = this.db.prepare(`SELECT value FROM ${this.tableName} WHERE key = ?`).get(key) as { value: string } | undefined;
    return row ? row.value : null;
  }

  set(key: string, value: string): void {
    const existing = this.db.prepare(`SELECT key FROM ${this.tableName} WHERE key = ?`).get(key);
    if (existing) {
      this.db.prepare(`UPDATE ${this.tableName} SET value = ? WHERE key = ?`).run(value, key);
    } else {
      this.db.prepare(`INSERT INTO ${this.tableName} (key, value) VALUES (?, ?)`).run(key, value);
    }
  }

  getJSON<T>(key: string, defaultValue: T): T {
    const value = this.get(key);
    if (value === null) return defaultValue;
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }

  setJSON(key: string, value: unknown): void {
    this.set(key, JSON.stringify(value));
  }
}
