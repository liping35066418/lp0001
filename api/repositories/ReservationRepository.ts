import { BaseRepository } from './BaseRepository.js';

export interface Reservation { [key: string]: unknown;
  id: number;
  room_id: number;
  customer_name: string;
  customer_phone: string;
  people_count: number;
  start_at: string;
  end_at: string;
  status: string;
  deposit_amount: number;
  remark: string;
  created_by: number;
  session_id: number;
  created_at: string;
}

const TABLE_NAME = 'reservation';
const COLUMNS = ['id', 'room_id', 'customer_name', 'customer_phone', 'people_count', 'start_at', 'end_at', 'status', 'deposit_amount', 'remark', 'created_by', 'session_id', 'created_at'];

export class ReservationRepository extends BaseRepository<Reservation> {
  constructor() {
    super(TABLE_NAME, COLUMNS);
  }

  findByRoomAndTimeRange(roomId: number, startAt: string, endAt: string, excludeId?: number): Reservation[] {
    let sql = `SELECT * FROM ${this.tableName} WHERE room_id = ? AND start_at < ? AND end_at > ?`;
    const params: unknown[] = [roomId, endAt, startAt];
    if (excludeId !== undefined) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    sql += ' ORDER BY start_at ASC';
    return this.db.prepare(sql).all(...params) as Reservation[];
  }

  findTodayPending(): Reservation[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE status = 'pending' AND DATE(start_at) = DATE('now', 'localtime') ORDER BY start_at ASC`;
    return this.db.prepare(sql).all() as Reservation[];
  }
}
