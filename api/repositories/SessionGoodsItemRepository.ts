import { BaseRepository } from './BaseRepository.js';

export interface SessionGoodsItem { [key: string]: unknown;
  id: number;
  session_id: number;
  goods_id: number;
  goods_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
}

const TABLE_NAME = 'session_goods_item';
const COLUMNS = ['id', 'session_id', 'goods_id', 'goods_name', 'quantity', 'unit_price', 'subtotal', 'created_at'];

export class SessionGoodsItemRepository extends BaseRepository<SessionGoodsItem> {
  constructor() {
    super(TABLE_NAME, COLUMNS);
  }

  findBySession(sessionId: number): SessionGoodsItem[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE session_id = ? ORDER BY created_at ASC`;
    return this.db.prepare(sql).all(sessionId) as SessionGoodsItem[];
  }
}
