import { BaseRepository } from './BaseRepository.js';

export interface GoodsCategory { [key: string]: unknown;
  id: number;
  name: string;
  sort: number;
}

const TABLE_NAME = 'goods_category';
const COLUMNS = ['id', 'name', 'sort'];

export class GoodsCategoryRepository extends BaseRepository<GoodsCategory> {
  constructor() {
    super(TABLE_NAME, COLUMNS);
  }
}
