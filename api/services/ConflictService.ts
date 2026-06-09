import { ReservationRepository } from '../repositories/ReservationRepository.js';
import type { Reservation } from '../../shared/api-types.js';

export class ConflictService {
  private static reservationRepo = new ReservationRepository();

  static hasConflict(roomId: number, startAt: string, endAt: string, excludeId?: number): boolean {
    const conflicts = this.reservationRepo.findByRoomAndTimeRange(roomId, startAt, endAt, excludeId);
    const activeConflicts = conflicts.filter(
      (r) => r.status === 'pending' || r.status === 'checked_in',
    );
    return activeConflicts.length > 0;
  }

  static getConflictingReservations(
    roomId: number,
    startAt: string,
    endAt: string,
    excludeId?: number,
  ): Reservation.Reservation[] {
    const conflicts = this.reservationRepo.findByRoomAndTimeRange(roomId, startAt, endAt, excludeId);
    return conflicts
      .filter((r) => r.status === 'pending' || r.status === 'checked_in')
      .map((r) => ({
        id: r.id,
        roomId: r.room_id,
        customerName: r.customer_name,
        customerPhone: r.customer_phone,
        peopleCount: r.people_count,
        startAt: r.start_at,
        endAt: r.end_at,
        status: r.status as Reservation.Status,
        depositAmount: r.deposit_amount,
        remark: r.remark || undefined,
        createdBy: r.created_by,
        createdAt: r.created_at,
        sessionId: r.session_id || undefined,
      }));
  }
}

export default ConflictService;
