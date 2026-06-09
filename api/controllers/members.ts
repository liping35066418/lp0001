import { Router, type Request, type Response } from 'express';
import { ok, fail, notFound } from '../utils/response.js';
import { authRequired } from '../middleware/auth.js';
import { getDb } from '../utils/db.js';
import dayjs from 'dayjs';
import { Member as M } from '../../shared/api-types.js';

const router = Router();
const db = getDb();

router.use(authRequired);

function mapMemberRow(row: any): M.Member {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    level: row.level as M.Level,
    totalSpend: row.total_spend,
    totalVisits: row.total_visits,
    remark: row.remark ?? undefined,
    createdAt: row.created_at,
  };
}

function calcCouponDiscount(coupon: Omit<M.AvailableCoupon, 'id' | 'memberCouponId' | 'name' | 'expireAt'>, subtotal: number): number {
  if (subtotal < coupon.minAmount) return 0;
  if (coupon.type === 'fixed') {
    return Math.min(coupon.value, subtotal);
  }
  return Number((subtotal * (1 - coupon.value / 100)).toFixed(2));
}

const LEVEL_WEIGHT: Record<M.Level, number> = {
  normal: 0,
  silver: 1,
  gold: 2,
  diamond: 3,
};

function levelMatches(couponLevel: string | null | undefined, memberLevel: M.Level): boolean {
  if (!couponLevel) return true;
  return LEVEL_WEIGHT[memberLevel] >= LEVEL_WEIGHT[couponLevel as M.Level];
}

router.get('/by-phone/:phone', async (req: Request, res: Response): Promise<void> => {
  try {
    const phone = String(req.params.phone);
    const row = db.prepare('SELECT * FROM member WHERE phone = ?').get(phone) as any;
    if (!row) {
      ok(res, { member: null }, '未找到会员');
      return;
    }
    ok(res, { member: mapMemberRow(row) });
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/query-discount', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as M.QueryMemberReq;
    if (!body.phone || body.subtotal === undefined) {
      fail(res, '缺少必填字段');
      return;
    }
    const subtotal = Number(body.subtotal) || 0;
    const memberRow = db.prepare('SELECT * FROM member WHERE phone = ?').get(body.phone) as any;

    if (!memberRow) {
      ok(res, {
        member: undefined,
        levelDiscountRate: 1,
        levelDiscountAmount: 0,
        availableCoupons: [],
        bestDiscountAmount: 0,
        bestDiscountType: 'none' as const,
      } as M.MemberDiscountResp);
      return;
    }

    const member = mapMemberRow(memberRow);
    const rate = M.LEVEL_DISCOUNT[member.level];
    const levelDiscountAmount = Number((subtotal * (1 - rate)).toFixed(2));

    const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
    const couponRows = db.prepare(`
      SELECT mc.id as member_coupon_id, mc.expire_at,
             c.id as coupon_id, c.name, c.type, c.value, c.min_amount, c.member_level, c.description
      FROM member_coupon mc
      LEFT JOIN coupon c ON mc.coupon_id = c.id
      WHERE mc.member_id = ?
        AND mc.status = 'unused'
        AND c.status = 'active'
        AND mc.expire_at > ?
      ORDER BY c.min_amount ASC
    `).all(member.id, now) as any[];

    const availableCoupons: M.AvailableCoupon[] = [];
    let bestCouponAmount = 0;
    let bestCouponId: number | undefined;

    for (const cr of couponRows) {
      if (!levelMatches(cr.member_level, member.level)) continue;
      const discount = calcCouponDiscount(
        { type: cr.type, value: cr.value, minAmount: cr.min_amount },
        subtotal,
      );
      if (discount <= 0) continue;
      const ac: M.AvailableCoupon = {
        id: cr.coupon_id,
        memberCouponId: cr.member_coupon_id,
        name: cr.name,
        type: cr.type,
        value: cr.value,
        minAmount: cr.min_amount,
        description: cr.description ?? undefined,
        expireAt: cr.expire_at,
      };
      availableCoupons.push(ac);
      if (discount > bestCouponAmount) {
        bestCouponAmount = discount;
        bestCouponId = ac.memberCouponId;
      }
    }

    let bestDiscountType: M.MemberDiscountResp['bestDiscountType'] = 'none';
    let bestDiscountAmount = 0;
    if (levelDiscountAmount > 0 || bestCouponAmount > 0) {
      if (levelDiscountAmount >= bestCouponAmount) {
        bestDiscountType = 'level';
        bestDiscountAmount = levelDiscountAmount;
      } else {
        bestDiscountType = 'coupon';
        bestDiscountAmount = bestCouponAmount;
      }
    }

    ok(res, {
      member,
      levelDiscountRate: rate,
      levelDiscountAmount,
      availableCoupons,
      bestDiscountAmount,
      bestDiscountType,
      bestCouponId,
    } as M.MemberDiscountResp);
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

router.post('/apply-discount', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as M.ApplyDiscountReq;
    const subtotal = Number(body.subtotal) || 0;
    if (!body.memberId) {
      ok(res, { discountAmount: 0, discountType: 'none' as const, member: undefined, couponId: undefined });
      return;
    }

    const memberRow = db.prepare('SELECT * FROM member WHERE id = ?').get(body.memberId) as any;
    if (!memberRow) {
      notFound(res, '会员不存在');
      return;
    }
    const member = mapMemberRow(memberRow);
    const rate = M.LEVEL_DISCOUNT[member.level];
    const levelDiscountAmount = Number((subtotal * (1 - rate)).toFixed(2));

    let couponDiscountAmount = 0;
    let couponId: number | undefined;

    if (body.useMemberCouponId) {
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
      const cr = db.prepare(`
        SELECT mc.id as member_coupon_id, mc.expire_at,
               c.id as coupon_id, c.name, c.type, c.value, c.min_amount, c.member_level
        FROM member_coupon mc
        LEFT JOIN coupon c ON mc.coupon_id = c.id
        WHERE mc.id = ? AND mc.member_id = ?
          AND mc.status = 'unused' AND c.status = 'active' AND mc.expire_at > ?
      `).get(body.useMemberCouponId, body.memberId, now) as any;

      if (cr && levelMatches(cr.member_level, member.level)) {
        const discount = calcCouponDiscount(
          { type: cr.type, value: cr.value, minAmount: cr.min_amount },
          subtotal,
        );
        couponDiscountAmount = discount;
        couponId = cr.member_coupon_id;
      }
    }

    let finalDiscount = 0;
    let finalType: 'none' | 'level' | 'coupon' = 'none';
    let finalCouponId: number | undefined;

    if (levelDiscountAmount >= couponDiscountAmount && levelDiscountAmount > 0) {
      finalDiscount = levelDiscountAmount;
      finalType = 'level';
    } else if (couponDiscountAmount > 0) {
      finalDiscount = couponDiscountAmount;
      finalType = 'coupon';
      finalCouponId = couponId;
    }

    ok(res, {
      discountAmount: Number(finalDiscount.toFixed(2)),
      discountType: finalType,
      member,
      couponId: finalCouponId,
    });
  } catch (e) {
    fail(res, (e as Error).message);
  }
});

export function markCouponUsed(memberCouponId: number): void {
  const now = dayjs().format('YYYY-MM-DD HH:mm:ss');
  db.prepare(`
    UPDATE member_coupon SET status = 'used', used_at = ? WHERE id = ?
  `).run(now, memberCouponId);
}

export function incrementMemberStats(memberId: number, spendAmount: number): void {
  db.prepare(`
    UPDATE member
    SET total_spend = total_spend + ?, total_visits = total_visits + 1
    WHERE id = ?
  `).run(spendAmount, memberId);
}

export function findMemberByPhone(phone: string): M.Member | null {
  const row = db.prepare('SELECT * FROM member WHERE phone = ?').get(phone) as any;
  return row ? mapMemberRow(row) : null;
}

export default router;
