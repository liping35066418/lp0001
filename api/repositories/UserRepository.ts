import { BaseRepository } from './BaseRepository.js';

export interface User { [key: string]: unknown;
  id: number;
  username: string;
  password_hash: string;
  real_name: string;
  role: string;
  phone: string;
  status: string;
  last_login_at: string;
  created_at: string;
}

const TABLE_NAME = 'user';
const COLUMNS = ['id', 'username', 'password_hash', 'real_name', 'role', 'phone', 'status', 'last_login_at', 'created_at'];

export class UserRepository extends BaseRepository<User> {
  constructor() {
    super(TABLE_NAME, COLUMNS);
  }

  findByUsername(username: string): User | null {
    const row = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE username = ?`).get(username) as User | undefined;
    return row ?? null;
  }
}
