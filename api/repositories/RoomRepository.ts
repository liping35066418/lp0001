import { BaseRepository } from './BaseRepository.js';

export interface Room { [key: string]: unknown;
  id: number;
  name: string;
  spec: string;
  capacity: number;
  base_price: number;
  status: string;
  description: string;
  created_at: string;
}

const TABLE_NAME = 'room';
const COLUMNS = ['id', 'name', 'spec', 'capacity', 'base_price', 'status', 'description', 'created_at'];

export class RoomRepository extends BaseRepository<Room> {
  constructor() {
    super(TABLE_NAME, COLUMNS);
  }
}
