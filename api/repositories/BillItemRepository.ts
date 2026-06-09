import { BaseRepository } from './BaseRepository.js';

export interface BillItem { [key: string]: unknown;
  id: number;
  bill_id: number;
  type: string;
  name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  ref_id: number;
}

const TABLE_NAME = 'bill_item';
const COLUMNS = ['id', 'bill_id', 'type', 'name', 'quantity', 'unit_price', 'subtotal', 'ref_id'];

export class BillItemRepository extends BaseRepository<BillItem> {
  constructor() {
    super(TABLE_NAME, COLUMNS);
  }

  findByBill(billId: number): BillItem[] {
    const sql = `SELECT * FROM ${this.tableName} WHERE bill_id = ? ORDER BY id ASC`;
    return this.db.prepare(sql).all(billId) as BillItem[];
  }
}
