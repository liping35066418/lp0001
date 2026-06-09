import { BaseRepository } from './BaseRepository.js';

export interface Rental { [key: string]: unknown;
  id: number;
  session_id: number;
  boardgame_id: number;
  deposit_collected: number;
  rental_fee: number;
  accessories_checked: string;
  status: string;
  rented_at: string;
  returned_at: string;
  accessories_returned: string;
  damage_fee: number;
  deposit_refunded: number;
  created_by: number;
  remark: string;
}

const TABLE_NAME = 'rental';
const COLUMNS = ['id', 'session_id', 'boardgame_id', 'deposit_collected', 'rental_fee', 'accessories_checked', 'status', 'rented_at', 'returned_at', 'accessories_returned', 'damage_fee', 'deposit_refunded', 'created_by', 'remark'];

export class RentalRepository extends BaseRepository<Rental> {
  constructor() {
    super(TABLE_NAME, COLUMNS);
  }

  findActiveBySession(sessionId: number): Rental[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE session_id = ? AND status = 'rented' ORDER BY rented_at DESC`;
    return this.db.prepare(sql).all(sessionId) as Rental[];
  }

  findActiveRentals(): Rental[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE status = 'rented' ORDER BY rented_at DESC`;
    return this.db.prepare(sql).all() as Rental[];
  }
}
