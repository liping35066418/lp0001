import dayjs from 'dayjs';
import { getDb } from '../utils/db.js';
import type { Settings, Session, Rental, Goods } from '../../shared/api-types.js';

const DEFAULT_PRICING_RULE: Settings.PricingRule = {
  overtimeUnit: 'half_hour',
  overtimeRate: 1.0,
  overtimeMode: 'ratio',
  minimumChargeMinutes: 60,
  freeGraceMinutes: 10,
  reminderMinutesBeforeEnd: 15,
};

export class PricingService {
  static getPricingRule(): Settings.PricingRule {
    const db = getDb();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'pricing_rule'").get() as { value: string } | undefined;
    if (!row) return DEFAULT_PRICING_RULE;
    try {
      return JSON.parse(row.value) as Settings.PricingRule;
    } catch {
      return DEFAULT_PRICING_RULE;
    }
  }

  static calculateRoomFee(
    basePrice: number,
    startAt: string,
    scheduledEnd: string,
    actualNow?: string,
  ): {
    roomFee: number;
    elapsedMinutes: number;
    overtimeMinutes: number;
    overtimeFee: number;
  } {
    const rule = PricingService.getPricingRule();
    const now = actualNow ? dayjs(actualNow) : dayjs();
    const start = dayjs(startAt);
    const scheduledEndTime = dayjs(scheduledEnd);

    const totalElapsed = Math.max(0, now.diff(start, 'minute'));
    const scheduledMinutes = Math.max(0, scheduledEndTime.diff(start, 'minute'));
    const effectiveScheduled = Math.max(scheduledMinutes, rule.minimumChargeMinutes);

    let overtimeMinutes = 0;
    let overtimeFee = 0;

    if (now.isAfter(scheduledEndTime)) {
      const rawOvertime = now.diff(scheduledEndTime, 'minute');
      const chargeableOvertime = Math.max(0, rawOvertime - rule.freeGraceMinutes);

      if (chargeableOvertime > 0) {
        let unitMinutes = 60;
        if (rule.overtimeUnit === 'half_hour') unitMinutes = 30;
        if (rule.overtimeUnit === 'minute') unitMinutes = 1;

        overtimeMinutes = Math.ceil(chargeableOvertime / unitMinutes) * unitMinutes;

        const overtimeHours = overtimeMinutes / 60;
        if (rule.overtimeMode === 'fixed') {
          overtimeFee = Number((overtimeHours * rule.overtimeRate).toFixed(2));
        } else {
          overtimeFee = Number((overtimeHours * basePrice * rule.overtimeRate).toFixed(2));
        }
      }
    }

    const roomFee = Number((effectiveScheduled / 60 * basePrice).toFixed(2));
    const elapsedMinutes = totalElapsed;

    return { roomFee, elapsedMinutes, overtimeMinutes, overtimeFee };
  }

  static calculateSessionTotals(
    session: Session.Session,
    rentals: Rental.Rental[],
    goodsItems: Goods.GoodsItemInBill[],
  ): {
    roomFee: number;
    overtimeFee: number;
    rentalFee: number;
    goodsFee: number;
    subtotal: number;
    discountAmount: number;
    totalAmount: number;
  } {
    const db = getDb();
    const roomRow = db.prepare('SELECT base_price FROM room WHERE id = ?').get(session.roomId) as { base_price: number } | undefined;
    const basePrice = roomRow?.base_price ?? 0;

    const result = PricingService.calculateRoomFee(
      basePrice,
      session.startAt,
      session.scheduledEndAt,
      session.actualEndAt,
    );

    const rentalFee = rentals.reduce((sum, r) => sum + (r.rentalFee || 0), 0);
    const goodsFee = goodsItems.reduce((sum, g) => sum + (g.subtotal || 0), 0);
    const roomFee = result.roomFee;
    const overtimeFee = result.overtimeFee;
    const discountAmount = session.discountAmount || 0;
    const subtotal = Number((roomFee + overtimeFee + rentalFee + goodsFee).toFixed(2));
    const totalAmount = Number((subtotal - discountAmount).toFixed(2));

    return {
      roomFee,
      overtimeFee,
      rentalFee,
      goodsFee,
      subtotal,
      discountAmount,
      totalAmount,
    };
  }
}

export default PricingService;
