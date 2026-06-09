import { BaseRepository } from './BaseRepository.js';

export interface Bill { [key: string]: unknown;
  id: number;
  bill_no: string;
  session_id: number;
  room_id: number;
  customer_name: string;
  start_at: string;
  end_at: string;
  duration_minutes: number;
  room_fee: number;
  overtime_fee: number;
  rental_fee: number;
  goods_fee: number;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  pay_method: string;
  paid_amount: number;
  change_amount: number;
  deposit_refund: number;
  created_by: number;
  created_at: string;
}

const TABLE_NAME = 'bill';
const COLUMNS = ['id', 'bill_no', 'session_id', 'room_id', 'customer_name', 'start_at', 'end_at', 'duration_minutes', 'room_fee', 'overtime_fee', 'rental_fee', 'goods_fee', 'subtotal', 'discount_amount', 'total_amount', 'pay_method', 'paid_amount', 'change_amount', 'deposit_refund', 'created_by', 'created_at'];

export class BillRepository extends BaseRepository<Bill> {
  constructor() {
    super(TABLE_NAME, COLUMNS);
  }

  findBySession(sessionId: number): Bill | null {
    const row = this.db.prepare(`SELECT * FROM ${this.tableName} WHERE session_id = ?`).get(sessionId) as Bill | undefined;
    return row ?? null;
  }
}
