import { BaseRepository } from './BaseRepository.js';

export interface Session { [key: string]: unknown;
  id: number;
  room_id: number;
  reservation_id: number;
  customer_name: string;
  customer_phone: string;
  people_count: number;
  start_at: string;
  scheduled_end_at: string;
  actual_end_at: string;
  status: string;
  room_fee: number;
  overtime_fee: number;
  rental_fee: number;
  goods_fee: number;
  discount_amount: number;
  total_amount: number;
  created_by: number;
  created_at: string;
}

const TABLE_NAME = 'session';
const COLUMNS = ['id', 'room_id', 'reservation_id', 'customer_name', 'customer_phone', 'people_count', 'start_at', 'scheduled_end_at', 'actual_end_at', 'status', 'room_fee', 'overtime_fee', 'rental_fee', 'goods_fee', 'discount_amount', 'total_amount', 'created_by', 'created_at'];

export class SessionRepository extends BaseRepository<Session> {
  constructor() {
    super(TABLE_NAME, COLUMNS);
  }

  findActive(): Session[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE status = 'active' ORDER BY start_at DESC`;
    return this.db.prepare(sql).all() as Session[];
  }
}
