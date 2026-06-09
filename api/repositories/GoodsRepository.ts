import { BaseRepository } from './BaseRepository.js';

export interface Goods { [key: string]: unknown;
  id: number;
  category_id: number;
  name: string;
  image: string;
  price: number;
  stock: number;
  unit: string;
  status: string;
  created_at: string;
}

const TABLE_NAME = 'goods';
const COLUMNS = ['id', 'category_id', 'name', 'image', 'price', 'stock', 'unit', 'status', 'created_at'];

export class GoodsRepository extends BaseRepository<Goods> {
  constructor() {
    super(TABLE_NAME, COLUMNS);
  }
}
