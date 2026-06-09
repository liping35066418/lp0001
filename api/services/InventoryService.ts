import { getDb } from '../utils/db.js';

export class InventoryService {
  private static db = getDb();

  static verifyBoardgameAvailable(boardgameId: number): boolean {
    const row = this.db.prepare(
      'SELECT stock_available, status FROM boardgame WHERE id = ?',
    ).get(boardgameId) as { stock_available: number; status: string } | undefined;
    if (!row) return false;
    return row.status === 'active' && row.stock_available > 0;
  }

  static decrementBoardgameStock(boardgameId: number, qty = 1): void {
    this.db.transaction(() => {
      const row = this.db.prepare(
        'SELECT stock_available FROM boardgame WHERE id = ?',
      ).get(boardgameId) as { stock_available: number } | undefined;
      if (!row) {
        throw new Error('桌游不存在');
      }
      if (row.stock_available < qty) {
        throw new Error('桌游库存不足');
      }
      this.db.prepare(
        'UPDATE boardgame SET stock_available = stock_available - ? WHERE id = ?',
      ).run(qty, boardgameId);
    })();
  }

  static incrementBoardgameStock(boardgameId: number, qty = 1): void {
    this.db.transaction(() => {
      const row = this.db.prepare(
        'SELECT id, stock_available, stock_total FROM boardgame WHERE id = ?',
      ).get(boardgameId) as { id: number; stock_available: number; stock_total: number } | undefined;
      if (!row) {
        throw new Error('桌游不存在');
      }
      const newAvailable = Math.min(row.stock_available + qty, row.stock_total);
      this.db.prepare(
        'UPDATE boardgame SET stock_available = ? WHERE id = ?',
      ).run(newAvailable, boardgameId);
    })();
  }

  static verifyGoodsAvailable(goodsId: number, qty: number): boolean {
    const row = this.db.prepare(
      'SELECT stock, status FROM goods WHERE id = ?',
    ).get(goodsId) as { stock: number; status: string } | undefined;
    if (!row) return false;
    return row.status === 'on_sale' && row.stock >= qty;
  }

  static decrementGoodsStock(goodsId: number, qty: number): void {
    this.db.transaction(() => {
      const row = this.db.prepare(
        'SELECT stock FROM goods WHERE id = ?',
      ).get(goodsId) as { stock: number } | undefined;
      if (!row) {
        throw new Error('商品不存在');
      }
      if (row.stock < qty) {
        throw new Error('商品库存不足');
      }
      this.db.prepare(
        'UPDATE goods SET stock = stock - ? WHERE id = ?',
      ).run(qty, goodsId);
    })();
  }

  static incrementGoodsStock(goodsId: number, qty: number): void {
    this.db.transaction(() => {
      const exists = this.db.prepare(
        'SELECT id FROM goods WHERE id = ?',
      ).get(goodsId) as { id: number } | undefined;
      if (!exists) {
        throw new Error('商品不存在');
      }
      this.db.prepare(
        'UPDATE goods SET stock = stock + ? WHERE id = ?',
      ).run(qty, goodsId);
    })();
  }
}

export default InventoryService;
