import { BaseRepository } from './BaseRepository.js';

export interface Boardgame { [key: string]: unknown;
  id: number;
  name: string;
  cover_image: string;
  category: string;
  difficulty: string;
  min_players: number;
  max_players: number;
  play_minutes: number;
  accessories: string;
  deposit: number;
  rental_fee: number;
  stock_total: number;
  stock_available: number;
  status: string;
  remark: string;
  created_at: string;
}

const TABLE_NAME = 'boardgame';
const COLUMNS = ['id', 'name', 'cover_image', 'category', 'difficulty', 'min_players', 'max_players', 'play_minutes', 'accessories', 'deposit', 'rental_fee', 'stock_total', 'stock_available', 'status', 'remark', 'created_at'];

export class BoardgameRepository extends BaseRepository<Boardgame> {
  constructor() {
    super(TABLE_NAME, COLUMNS);
  }
}
