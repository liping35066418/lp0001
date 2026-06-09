import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ChevronUp,
  Clock,
  Dice6,
  ShoppingBag,
  Receipt,
  User,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Home,
  Banknote,
  Smartphone,
  CreditCard,
  Printer,
  QrCode,
  ArrowLeft,
  Calculator,
  Minus,
  Search,
  Crown,
  Ticket,
  Bell,
  Phone,
  Users,
  X,
} from 'lucide-react';
import type { Session as SS, Bill as BL, Rental as RT, Queue as Q } from '../../shared/api-types';
import { Member as M } from '../../shared/api-types';
import { get, post } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import {
  formatMoney,
  formatDateTime,
  formatMinutes,
  cnStatusPay,
} from '@/utils/format';
import { cn } from '@/lib/utils';
import dayjs from 'dayjs';
import Modal from '@/components/common/Modal';
import CallingNotification from '@/components/dashboard/CallingNotification';

type PayMethod = BL.PayMethod;

const PAY_METHODS: {
  value: PayMethod;
  label: string;
  icon: typeof Banknote;
  color: string;
}[] = [
  { value: 'cash', label: '现金', icon: Banknote, color: 'border-green-500 bg-green-50 text-green-700' },
  { value: 'wechat', label: '微信', icon: Smartphone, color: 'border-emerald-500 bg-emerald-50 text-emerald-700' },
  { value: 'alipay', label: '支付宝', icon: CreditCard, color: 'border-sky-500 bg-sky-50 text-sky-700' },
];

interface SectionProps {
  title: string;
  icon: typeof Clock;
  iconColor: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function Section({ title, icon: Icon, iconColor, open, onToggle, children }: SectionProps) {
  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', iconColor)}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="font-semibold text-slate-800 flex-1">{title}</span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {open && <div className="px-4 py-4 animate-slide-up">{children}</div>}
    </div>
  );
}

export default function Checkout() {
  const navigate = useNavigate();
  const { sessionId } = useParams<{ sessionId: string }>();
  const { pushToast, pushLoading, popLoading } = useUIStore();

  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<SS.SessionDetail | null>(null);
  const [roomPrice, setRoomPrice] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const [openSections, setOpenSections] = useState({
    room: true,
    rental: true,
    goods: true,
    total: true,
  });

  const [discountAmount, setDiscountAmount] = useState(0);
  const [payMethod, setPayMethod] = useState<PayMethod>('cash');
  const [paidAmount, setPaidAmount] = useState(0);

  const [billResult, setBillResult] = useState<BL.Bill | null>(null);

  const [memberPhone, setMemberPhone] = useState('');
  const [memberQuerying, setMemberQuerying] = useState(false);
  const [memberData, setMemberData] = useState<M.MemberDiscountResp | null>(null);
  const [selectedCouponId, setSelectedCouponId] = useState<number | undefined>(undefined);
  const [useBestDeal, setUseBestDeal] = useState(true);
  const [calledWaiting, setCalledWaiting] = useState<any>(null);

  const subtotal = useMemo(() => {
    if (!session) return 0;
    return (
      session.roomFee +
      session.overtimeFee +
      session.rentalFee +
      session.goodsFee
    );
  }, [session]);

  const discountInfo = useMemo(() => {
    if (!memberData?.member || (!useBestDeal && selectedCouponId === undefined)) {
      return { type: 'manual', amount: discountAmount, description: '手动优惠' } as const;
    }
    const md = memberData;
    const rateTxt = md.levelDiscountRate < 1
      ? `${Math.round(md.levelDiscountRate * 10)}折`
      : '无折扣';
    if (useBestDeal) {
      if (md.bestDiscountType === 'level') {
        return {
          type: 'level' as const,
          amount: md.levelDiscountAmount,
          rate: md.levelDiscountRate,
          description: `${M.LEVEL_NAME[md.member.level]}会员${rateTxt}`,
          memberId: md.member.id,
        };
      }
      if (md.bestDiscountType === 'coupon') {
        const cp = md.availableCoupons.find((c) => c.memberCouponId === md.bestCouponId);
        return {
          type: 'coupon' as const,
          amount: md.bestDiscountAmount,
          description: `优惠券：${cp?.name || '会员券'}`,
          memberId: md.member.id,
          couponId: md.bestCouponId,
        };
      }
    }
    if (selectedCouponId !== undefined) {
      const cp = md.availableCoupons.find((c) => c.memberCouponId === selectedCouponId);
      const couponDiscount = cp
        ? cp.type === 'fixed'
          ? cp.value
          : Number((subtotal * (1 - cp.value / 100)).toFixed(2))
        : 0;
      return {
        type: 'coupon' as const,
        amount: Number(couponDiscount),
        description: `优惠券：${cp?.name}`,
        memberId: md.member.id,
        couponId: cp?.memberCouponId,
      };
    }
    return {
      type: 'level' as const,
      amount: md.levelDiscountAmount,
      rate: md.levelDiscountRate,
      description: `${M.LEVEL_NAME[md.member.level]}会员${rateTxt}`,
      memberId: md.member.id,
    };
  }, [memberData, useBestDeal, selectedCouponId, discountAmount, subtotal]);

  useEffect(() => {
    const init = async () => {
      if (!sessionId) return;
      setLoading(true);
      pushLoading();
      try {
        const data = await get<SS.SessionDetail>(`/sessions/${sessionId}`);
        setSession(data);
        if (data.customerPhone) {
          setMemberPhone(data.customerPhone);
          queryMember(data.customerPhone);
        }
        const room = await get<{ basePrice: number }>(`/rooms/${data.roomId}`).catch(() => ({
          basePrice: 0,
        }));
        setRoomPrice(room.basePrice || 0);
      } catch (e) {
        pushToast((e as Error).message, 'error');
      } finally {
        setLoading(false);
        popLoading();
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const queryMember = async (phone?: string) => {
    const p = (phone ?? memberPhone).trim();
    if (!p) {
      setMemberData(null);
      return;
    }
    setMemberQuerying(true);
    try {
      const data = await post<M.MemberDiscountResp>('/members/query-discount', {
        phone: p,
        subtotal: Number(subtotal),
      });
      setMemberData(data);
      if (data.member) {
        pushToast(
          `识别为${M.LEVEL_NAME[data.member.level]} · 已为您计算最优优惠`,
          'success',
        );
      }
    } catch (e) {
      pushToast((e as Error).message || '会员查询失败', 'error');
    } finally {
      setMemberQuerying(false);
    }
  };

  useEffect(() => {
    if (memberData && discountInfo.type !== 'manual') {
      const amt = Number(discountInfo.amount.toFixed(2));
      if (Math.abs(amt - discountAmount) > 0.01) {
        setDiscountAmount(amt);
      }
    }
  }, [discountInfo, memberData, discountAmount]);

  const totalAmount = useMemo(() => {
    return Math.max(0, Number((subtotal - discountAmount).toFixed(2)));
  }, [subtotal, discountAmount]);

  useEffect(() => {
    if (payMethod === 'cash') {
      if (paidAmount === 0 || paidAmount < totalAmount) {
        setPaidAmount(totalAmount);
      }
    } else {
      setPaidAmount(totalAmount);
    }
  }, [totalAmount, payMethod]);

  const changeAmount = useMemo(() => {
    return Math.max(0, Number((paidAmount - totalAmount).toFixed(2)));
  }, [paidAmount, totalAmount]);

  const depositRefund = useMemo(() => {
    if (!session) return 0;
    return session.rentals
      .filter((r) => r.status === 'active')
      .reduce((s, r) => s + r.depositCollected, 0);
  }, [session]);

  const totalHours = useMemo(() => {
    if (!session) return 0;
    return Math.max(1, Math.ceil(session.elapsedMinutes / 60));
  }, [session]);

  const toggleSection = (key: keyof typeof openSections) => {
    setOpenSections((o) => ({ ...o, [key]: !o[key] }));
  };

  const handleDiscountChange = (val: number) => {
    const v = Math.max(0, Math.min(val, subtotal));
    setDiscountAmount(v);
    if (errors.discountAmount) {
      setErrors((e) => {
        const n = { ...e };
        delete n.discountAmount;
        return n;
      });
    }
  };

  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (discountAmount > subtotal) e.discountAmount = '优惠金额不能大于小计';
    if (discountAmount < 0) e.discountAmount = '优惠金额不能为负';
    if (payMethod === 'cash' && paidAmount < totalAmount) {
      e.paidAmount = '实付金额不能小于应付金额';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleCheckout = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!session) return;
    if (!validate()) {
      pushToast('请检查填写', 'warn');
      return;
    }
    const activeRentals = session.rentals.filter((r) => r.status === 'active');
    if (activeRentals.length > 0) {
      pushToast('存在未归还的桌游，请先归还再结账', 'warn');
      return;
    }
    setSubmitting(true);
    pushLoading();
    try {
      const payload: any = {
        sessionId: session.id,
        discountAmount: Number(discountAmount),
        payMethod,
        paidAmount: Number(paidAmount),
        discountInfo: {
          type: discountInfo.type,
          description: discountInfo.description,
          couponId: (discountInfo as any).couponId,
        },
      };
      if ((discountInfo as any).memberId !== undefined) {
        payload.memberId = (discountInfo as any).memberId;
      }
      if ((discountInfo as any).couponId !== undefined) {
        payload.useMemberCouponId = (discountInfo as any).couponId;
      }

      const bill: any = await post<BL.Bill>('/bills/checkout', payload);
      (bill as BL.Bill & { _depositRefund?: number })._depositRefund = depositRefund;
      setBillResult(bill);
      if (bill._calledWaiting) {
        setCalledWaiting(bill._calledWaiting);
      }
      pushToast('结账成功', 'success');
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
      popLoading();
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-6 bg-slate-100 rounded w-24" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card p-6 h-32 animate-pulse-soft" />
            ))}
          </div>
          <div className="lg:col-span-2">
            <div className="card p-6 h-96 animate-pulse-soft" />
          </div>
        </div>
      </div>
    );
  }

  if (billResult) {
    const br = billResult as BL.Bill & { _depositRefund?: number };
    return (
      <>
        {calledWaiting && (
          <CallingNotification
            item={calledWaiting}
            onClose={() => setCalledWaiting(null)}
            onOpenRoom={() => {
              setCalledWaiting(null);
              navigate('/sessions');
            }}
          />
        )}
      <div className="space-y-6 animate-fade-in max-w-3xl mx-auto print:max-w-none">
        <div className="card p-8 print:shadow-none print:border print:border-black">
          <div className="text-center border-b border-dashed border-slate-300 pb-6 mb-6">
            <h1 className="text-2xl font-bold text-slate-800 mb-1">消费凭证</h1>
            <p className="text-sm text-slate-500">账单号：{br.billNo}</p>
            <div className="mt-4 inline-block">
              <div className="w-36 h-36 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-300">
                <div className="text-center">
                  <QrCode className="w-12 h-12 mx-auto text-slate-400 mb-1" />
                  <p className="text-xs text-slate-400">二维码占位</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">包厢</span>
                <span className="font-medium text-slate-800">{br.roomName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">顾客</span>
                <span className="font-medium text-slate-800">
                  {br.customerName || '散客'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">开始时间</span>
                <span className="font-medium text-slate-800">
                  {formatDateTime(br.startAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">结束时间</span>
                <span className="font-medium text-slate-800">
                  {formatDateTime(br.endAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">总时长</span>
                <span className="font-medium text-slate-800">
                  {formatMinutes(br.durationMinutes)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">结账时间</span>
                <span className="font-medium text-slate-800">
                  {formatDateTime(br.createdAt)}
                </span>
              </div>
            </div>

            <div className="border-t border-dashed border-slate-300 pt-4 mt-4">
              <div className="space-y-1.5">
                {br.roomFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">包厢时长费</span>
                    <span className="font-medium text-slate-800">
                      {formatMoney(br.roomFee)}
                    </span>
                  </div>
                )}
                {br.overtimeFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">超时费</span>
                    <span className="font-medium text-orange-600">
                      +{formatMoney(br.overtimeFee)}
                    </span>
                  </div>
                )}
                {br.rentalFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">桌游租赁费</span>
                    <span className="font-medium text-slate-800">
                      {formatMoney(br.rentalFee)}
                    </span>
                  </div>
                )}
                {br.goodsFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">商品消费</span>
                    <span className="font-medium text-slate-800">
                      {formatMoney(br.goodsFee)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-dashed border-slate-300 pt-4 mt-4 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-600">小计</span>
                <span className="font-medium text-slate-800">
                  {formatMoney(br.subtotal)}
                </span>
              </div>
              {br.discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">优惠</span>
                  <span className="font-medium text-red-500">
                    -{formatMoney(br.discountAmount)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold pt-2">
                <span className="text-slate-800">应付合计</span>
                <span className="text-primary-700">
                  {formatMoney(br.totalAmount)}
                </span>
              </div>
            </div>

            <div className="border-t border-dashed border-slate-300 pt-4 mt-4 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-600">支付方式</span>
                <span className="font-medium text-slate-800">
                  {cnStatusPay(br.payMethod)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">实付金额</span>
                <span className="font-semibold text-primary-700">
                  {formatMoney(br.paidAmount)}
                </span>
              </div>
              {br.changeAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">找零</span>
                  <span className="font-medium text-slate-700">
                    {formatMoney(br.changeAmount)}
                  </span>
                </div>
              )}
              {(br._depositRefund || br.depositRefund) > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">押金退还</span>
                  <span className="font-medium text-green-600">
                    {formatMoney(br._depositRefund || br.depositRefund)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-dashed border-slate-300 text-center">
            <p className="text-xs text-slate-400">感谢光临，欢迎下次再来！</p>
          </div>
        </div>

        <div className="flex gap-3 justify-center print:hidden">
          <button
            className="btn-outline"
            onClick={() => navigate('/sessions')}
          >
            <Home className="w-4 h-4" />
            返回场次
          </button>
          <button className="btn-primary" onClick={handlePrint}>
            <Printer className="w-4 h-4" />
            打印凭证
          </button>
        </div>
      </div>
      </>
    );
  }

  if (!session) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="card p-16 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-400 mb-3" />
          <p className="text-slate-600 mb-4">场次不存在或已删除</p>
          <button className="btn-primary" onClick={() => navigate('/sessions')}>
            返回场次列表
          </button>
        </div>
      </div>
    );
  }

  const activeRentals = session.rentals.filter((r) => r.status === 'active');

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          className="btn-ghost btn-sm"
          onClick={() => navigate('/sessions')}
        >
          <ArrowLeft className="w-4 h-4" />
          返回场次
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            账单结算 - {session.roomName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            场次 #{session.id} · 开始于 {formatDateTime(session.startAt)}
          </p>
        </div>
      </div>

      <form onSubmit={handleCheckout} className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-4">
          <div className="card p-5 bg-gradient-to-br from-primary-50 via-white to-white border-primary-100">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary-600" />
              基础信息
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-slate-500 text-xs mb-0.5">场次号</div>
                <div className="font-semibold text-slate-800 font-mono">
                  #{session.id}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs mb-0.5">顾客</div>
                <div className="font-semibold text-slate-800 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {session.customerName || '散客'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs mb-0.5">人数</div>
                <div className="font-semibold text-slate-800">
                  {session.peopleCount} 人
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs mb-0.5">开始时间</div>
                <div className="font-semibold text-slate-800">
                  {formatDateTime(session.startAt)}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs mb-0.5">结束时间</div>
                <div className="font-semibold text-slate-800">
                  {session.actualEndAt
                    ? formatDateTime(session.actualEndAt)
                    : '当前'}
                </div>
              </div>
              <div>
                <div className="text-slate-500 text-xs mb-0.5">总时长</div>
                <div className="font-semibold text-primary-700">
                  {formatMinutes(session.elapsedMinutes)}
                </div>
              </div>
            </div>
          </div>

          <Section
            title="包厢时长费"
            icon={Clock}
            iconColor="bg-primary-100 text-primary-700"
            open={openSections.room}
            onToggle={() => toggleSection('room')}
          >
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-slate-600">
                  基础时长 {totalHours} 小时 × {formatMoney(roomPrice)}/小时
                </span>
                <span className="font-medium text-slate-800">
                  {formatMoney(session.roomFee)}
                </span>
              </div>
              {session.overtimeMinutes > 0 && (
                <div className="flex justify-between py-1 text-orange-600">
                  <span>超时 {formatMinutes(session.overtimeMinutes)}</span>
                  <span className="font-medium">+{formatMoney(session.overtimeFee)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="font-semibold text-slate-700">包厢合计</span>
                <span className="font-bold text-primary-700">
                  {formatMoney(session.roomFee + session.overtimeFee)}
                </span>
              </div>
            </div>
          </Section>

          <Section
            title="桌游租赁费"
            icon={Dice6}
            iconColor="bg-accent-100 text-accent-700"
            open={openSections.rental}
            onToggle={() => toggleSection('rental')}
          >
            {session.rentals.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                本场次无桌游租借记录
              </p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs">
                      <th className="text-left font-medium px-2 py-2">桌游名称</th>
                      <th className="text-right font-medium px-2 py-2">押金</th>
                      <th className="text-right font-medium px-2 py-2">租借费</th>
                      <th className="text-center font-medium px-2 py-2">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.rentals.map((r: RT.RentalInfo & { damageFee?: number }) => {
                      const damage = r.damageFee || 0;
                      return (
                        <tr
                          key={r.id}
                          className="border-t border-slate-50"
                        >
                          <td className="px-2 py-2.5 font-medium text-slate-800">
                            {r.boardgameName}
                          </td>
                          <td className="px-2 py-2.5 text-right text-accent-600 font-medium">
                            {formatMoney(r.depositCollected)}
                          </td>
                          <td className="px-2 py-2.5 text-right text-primary-600 font-medium">
                            {formatMoney(r.rentalFee)}
                          </td>
                          <td className="px-2 py-2.5 text-center">
                            {r.status === 'active' ? (
                              <span className="badge bg-blue-100 text-blue-700">
                                <Clock className="w-3 h-3 mr-1" />
                                未归还
                              </span>
                            ) : r.status === 'damaged' ? (
                              <span className="badge bg-orange-100 text-orange-700">
                                <AlertCircle className="w-3 h-3 mr-1" />
                                损坏扣{formatMoney(damage)}
                              </span>
                            ) : (
                              <span className="badge bg-green-100 text-green-700">
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                已归还
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-100">
                      <td className="px-2 py-2.5 font-semibold text-slate-700">
                        合计
                      </td>
                      <td></td>
                      <td className="px-2 py-2.5 text-right font-bold text-primary-700">
                        {formatMoney(session.rentalFee)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {activeRentals.length > 0 && (
              <div className="mt-3 p-3 bg-orange-50 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-orange-700">
                  存在 {activeRentals.length} 件未归还的桌游，请先前往租借管理归还后再结账
                </p>
              </div>
            )}
            {depositRefund > 0 && (
              <div className="mt-3 p-3 bg-green-50 rounded-lg flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-green-700">
                  归还完成后将退还押金：
                  <span className="font-bold ml-1">
                    {formatMoney(depositRefund)}
                  </span>
                </p>
              </div>
            )}
          </Section>

          <Section
            title="商品消费"
            icon={ShoppingBag}
            iconColor="bg-sky-100 text-sky-700"
            open={openSections.goods}
            onToggle={() => toggleSection('goods')}
          >
            {session.goodsItems.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                本场次无商品消费
              </p>
            ) : (
              <div className="overflow-x-auto -mx-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-slate-500 text-xs">
                      <th className="text-left font-medium px-2 py-2">商品名称</th>
                      <th className="text-right font-medium px-2 py-2">数量</th>
                      <th className="text-right font-medium px-2 py-2">单价</th>
                      <th className="text-right font-medium px-2 py-2">小计</th>
                    </tr>
                  </thead>
                  <tbody>
                    {session.goodsItems.map((g) => (
                      <tr key={g.id} className="border-t border-slate-50">
                        <td className="px-2 py-2.5 font-medium text-slate-800">
                          {g.name}
                        </td>
                        <td className="px-2 py-2.5 text-right text-slate-600">
                          {g.quantity}
                        </td>
                        <td className="px-2 py-2.5 text-right text-slate-600">
                          {formatMoney(g.unitPrice)}
                        </td>
                        <td className="px-2 py-2.5 text-right font-semibold text-sky-700">
                          {formatMoney(g.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-100">
                      <td className="px-2 py-2.5 font-semibold text-slate-700">
                        合计
                      </td>
                      <td
                        className="px-2 py-2.5 text-right text-slate-600 font-medium"
                        colSpan={2}
                      >
                        共 {session.goodsItems.reduce((s, g) => s + g.quantity, 0)} 件
                      </td>
                      <td className="px-2 py-2.5 text-right font-bold text-sky-700">
                        {formatMoney(session.goodsFee)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Section>

          <Section
            title="费用汇总"
            icon={Calculator}
            iconColor="bg-violet-100 text-violet-700"
            open={openSections.total}
            onToggle={() => toggleSection('total')}
          >
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-slate-600">包厢费</span>
                <span className="font-medium text-slate-800">
                  {formatMoney(session.roomFee + session.overtimeFee)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">桌游租赁费</span>
                <span className="font-medium text-slate-800">
                  {formatMoney(session.rentalFee)}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-600">商品消费</span>
                <span className="font-medium text-slate-800">
                  {formatMoney(session.goodsFee)}
                </span>
              </div>
              <div className="flex justify-between py-2 border-t border-dashed border-slate-200">
                <span className="font-semibold text-slate-700">小计</span>
                <span className="font-bold text-slate-800 text-lg">
                  {formatMoney(subtotal)}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between py-1 text-red-500">
                  <span className="font-medium flex items-center gap-1">
                    <Minus className="w-3 h-3" />
                    优惠减免
                  </span>
                  <span className="font-bold">-{formatMoney(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 pt-3 border-t-2 border-primary-200 bg-primary-50/50 -mx-4 -mb-4 px-4">
                <span className="font-bold text-slate-800 text-base">应付总额</span>
                <span className="font-bold text-primary-700 text-2xl">
                  {formatMoney(totalAmount)}
                </span>
              </div>
            </div>
          </Section>
        </div>

        <div className="lg:col-span-2">
          <div className="card p-6 space-y-6 sticky top-6">
            <h3 className="font-semibold text-slate-800 text-lg flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary-600" />
              支付操作
            </h3>

            <div>
              <label className="label">会员手机号</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={memberPhone}
                    onChange={(e) => setMemberPhone(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        queryMember();
                      }
                    }}
                    placeholder="输入手机号识别会员"
                    className="input pl-9"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => queryMember()}
                  disabled={memberQuerying}
                  className="btn-outline px-4"
                >
                  {memberQuerying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  查询
                </button>
              </div>
            </div>

            {memberData?.member && (
              <div className="rounded-xl overflow-hidden shadow-sm">
                <div className="bg-gradient-to-br from-amber-400 via-orange-400 to-rose-400 p-4 text-white">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shrink-0">
                      <Crown className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base">{memberData.member.name}</span>
                        <span className={cn(
                          'badge text-xs',
                          memberData.member.level === 'diamond' && 'bg-cyan-200/30 text-white border border-white/30',
                          memberData.member.level === 'gold' && 'bg-yellow-200/30 text-white border border-white/30',
                          memberData.member.level === 'silver' && 'bg-slate-200/30 text-white border border-white/30',
                          memberData.member.level === 'normal' && 'bg-white/20 text-white border border-white/30',
                        )}>
                          {M.LEVEL_NAME[memberData.member.level]}
                        </span>
                      </div>
                      <div className="mt-1.5 text-xs text-white/90 space-y-0.5">
                        <div className="flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {memberData.member.phone}
                        </div>
                        <div>
                          累计到店 {memberData.member.totalVisits} 次 · 累计消费 {formatMoney(memberData.member.totalSpend)}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="bg-white/15 backdrop-blur rounded-lg p-2.5 border border-white/20">
                      <div className="text-[11px] text-white/80">等级折扣</div>
                      <div className="font-bold text-sm mt-0.5">
                        {memberData.levelDiscountRate < 1
                          ? `${Math.round(memberData.levelDiscountRate * 10)}折 省${formatMoney(memberData.levelDiscountAmount)}`
                          : '无折扣'
                        }
                      </div>
                    </div>
                    <div className="bg-white/15 backdrop-blur rounded-lg p-2.5 border border-white/20">
                      <div className="text-[11px] text-white/80 flex items-center gap-1">
                        <Ticket className="w-3 h-3" />
                        可用券
                      </div>
                      <div className="font-bold text-sm mt-0.5">
                        {memberData.availableCoupons.length} 张
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {memberData?.member && memberData.availableCoupons.length > 0 && (
              <div className="space-y-2">
                <label className="label !mb-1">可用优惠券</label>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {memberData.availableCoupons.map((cp) => {
                    const isBest = useBestDeal && memberData.bestDiscountType === 'coupon' && memberData.bestCouponId === cp.memberCouponId;
                    const isSelected = (!useBestDeal && selectedCouponId === cp.memberCouponId) || isBest;
                    const couponDiscount = cp.type === 'fixed'
                      ? cp.value
                      : Number((subtotal * (1 - cp.value / 100)).toFixed(2));
                    const gradients = [
                      'from-rose-500 to-pink-500',
                      'from-violet-500 to-purple-500',
                      'from-sky-500 to-blue-500',
                      'from-emerald-500 to-teal-500',
                      'from-amber-500 to-orange-500',
                    ];
                    const gradient = gradients[cp.memberCouponId % gradients.length];
                    return (
                      <label
                        key={cp.memberCouponId}
                        className={cn(
                          'block relative rounded-xl overflow-hidden cursor-pointer transition-all border-2',
                          isSelected
                            ? 'border-primary-500 shadow-md ring-2 ring-primary-100'
                            : 'border-transparent hover:border-slate-200'
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isSelected}
                          onChange={() => {
                            setUseBestDeal(false);
                            setSelectedCouponId(
                              selectedCouponId === cp.memberCouponId
                                ? undefined
                                : cp.memberCouponId
                            );
                          }}
                        />
                        <div className={cn('flex bg-gradient-to-r', gradient)}>
                          <div className="w-20 shrink-0 flex flex-col items-center justify-center text-white py-3 relative">
                            <div className="absolute left-0 top-0 bottom-0 w-[1px] bg-[repeating-linear-gradient(to_bottom,white_0,white_4px,transparent_4px,transparent_8px)] opacity-60" />
                            <div className="text-2xl font-bold leading-none">
                              {cp.type === 'fixed' ? (
                                <>¥{cp.value}</>
                              ) : (
                                <>{cp.value}<span className="text-lg">折</span></>
                              )}
                            </div>
                            {cp.minAmount > 0 && (
                              <div className="text-[10px] opacity-80 mt-1">
                                满{formatMoney(cp.minAmount)}可用
                              </div>
                            )}
                          </div>
                          <div className="flex-1 bg-white p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm text-slate-800 truncate">
                                  {cp.name}
                                </div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                  有效期至 {dayjs(cp.expireAt).format('YYYY.MM.DD')}
                                </div>
                                <div className="text-[11px] text-rose-600 mt-1 font-medium">
                                  预计省 {formatMoney(couponDiscount)}
                                </div>
                              </div>
                              {isBest && (
                                <span className="badge bg-rose-100 text-rose-700 text-[10px] shrink-0">
                                  最优
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-white" />
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {memberData?.member && discountInfo.amount > 0 && discountInfo.type !== 'manual' && (
              <div className="p-3 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-xl flex items-center justify-between">
                <span className="text-sm font-medium text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  预计共省
                </span>
                <span className="text-lg font-bold text-emerald-700">
                  {formatMoney(discountInfo.amount)}
                </span>
              </div>
            )}

            <div>
              <label className="label">优惠减免</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  ￥
                </span>
                <input
                  type="number"
                  min={0}
                  max={subtotal}
                  step={1}
                  value={discountAmount}
                  onChange={(e) => handleDiscountChange(Number(e.target.value))}
                  readOnly={discountInfo.type !== 'manual'}
                  className={cn(
                    'input pl-7 text-lg font-semibold pr-24',
                    discountInfo.type !== 'manual' && 'bg-primary-50 border-primary-200 focus:ring-primary-200',
                    errors.discountAmount &&
                      'border-red-500 focus:ring-red-500'
                  )}
                />
                {discountInfo.type !== 'manual' && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary-600 font-medium max-w-[80px] truncate text-right">
                    {discountInfo.description}
                  </div>
                )}
              </div>
              {discountInfo.type !== 'manual' ? (
                <button
                  type="button"
                  onClick={() => {
                    setUseBestDeal(false);
                    setSelectedCouponId(undefined);
                    setMemberData(null);
                  }}
                  className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  切换为手动优惠
                </button>
              ) : (
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  {[10, 20, 50, subtotal * 0.1, subtotal * 0.2]
                    .map((v) => Math.round(v * 100) / 100)
                    .filter((v) => v > 0 && v <= subtotal)
                    .map((v, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleDiscountChange(v)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border',
                          discountAmount === v
                            ? 'border-primary-500 bg-primary-50 text-primary-700'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        )}
                      >
                        -{formatMoney(v)}
                      </button>
                    ))}
                </div>
              )}
              {errors.discountAmount && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.discountAmount}
                </p>
              )}
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-primary-50 to-accent-50 border border-primary-100 space-y-3">
              <div className="flex justify-between items-baseline">
                <span className="text-slate-600 text-sm">合计应支付</span>
                <span className="text-3xl font-bold text-primary-700 tracking-tight">
                  {formatMoney(totalAmount)}
                </span>
              </div>
              {depositRefund > 0 && (
                <div className="flex justify-between items-baseline pt-2 border-t border-dashed border-primary-200">
                  <span className="text-slate-600 text-sm">押金应退</span>
                  <span className="text-lg font-semibold text-green-600">
                    {formatMoney(depositRefund)}
                  </span>
                </div>
              )}
            </div>

            <div>
              <label className="label">支付方式</label>
              <div className="grid grid-cols-3 gap-2">
                {PAY_METHODS.map((m) => {
                  const Icon = m.icon;
                  const active = payMethod === m.value;
                  return (
                    <label
                      key={m.value}
                      className={cn(
                        'cursor-pointer rounded-xl border-2 p-3 text-center transition-all',
                        active ? m.color : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                      )}
                    >
                      <input
                        type="radio"
                        name="payMethod"
                        value={m.value}
                        checked={active}
                        onChange={() => setPayMethod(m.value)}
                        className="sr-only"
                      />
                      <Icon className="w-6 h-6 mx-auto mb-1" />
                      <div className="text-xs font-semibold">{m.label}</div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="label">
                实付金额
                {payMethod === 'cash' && (
                  <span className="text-xs text-slate-400 ml-1">(现金可改)</span>
                )}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
                  ￥
                </span>
                <input
                  type="number"
                  min={totalAmount}
                  step={1}
                  value={paidAmount}
                  onChange={(e) =>
                    payMethod === 'cash'
                      ? setPaidAmount(Number(e.target.value))
                      : null
                  }
                  readOnly={payMethod !== 'cash'}
                  className={cn(
                    'input pl-7 text-xl font-bold',
                    payMethod !== 'cash' && 'bg-slate-50',
                    errors.paidAmount && 'border-red-500 focus:ring-red-500'
                  )}
                  onClick={() => {
                    if (payMethod === 'cash') {
                      (document.activeElement as HTMLInputElement)?.select();
                    }
                  }}
                  onFocus={(e) => payMethod === 'cash' && e.target.select()}
                />
              </div>
              {errors.paidAmount && (
                <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {errors.paidAmount}
                </p>
              )}
              {payMethod === 'cash' && changeAmount > 0 && (
                <div className="mt-2 flex justify-between items-center p-3 bg-green-50 rounded-xl border border-green-100">
                  <span className="text-sm text-green-700 font-medium">
                    找零
                  </span>
                  <span className="text-xl font-bold text-green-700">
                    {formatMoney(changeAmount)}
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              className="btn-primary btn-lg w-full text-base py-3"
              disabled={
                submitting ||
                activeRentals.length > 0 ||
                totalAmount <= 0 ||
                (payMethod === 'cash' && paidAmount < totalAmount)
              }
            >
              {submitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  结账中...
                </>
              ) : activeRentals.length > 0 ? (
                <>
                  <AlertCircle className="w-5 h-5" />
                  请先归还桌游
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  确认结账 · {formatMoney(totalAmount)}
                </>
              )}
            </button>

            <p className="text-xs text-slate-400 text-center">
              点击确认后将生成账单并结束本场次
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}
