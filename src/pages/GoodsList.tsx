import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Package,
  Settings,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check,
  AlertCircle,
  Coffee,
  UtensilsCrossed,
  Beer,
  Cookie,
} from 'lucide-react';
import type { Goods as GD, Session as SS } from '../../shared/api-types';
import { get, post } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import { useAuthStore } from '@/store/auth';
import { formatMoney } from '@/utils/format';
import { cn } from '@/lib/utils';

interface CartItem {
  goodsId: number;
  name: string;
  price: number;
  unit: string;
  quantity: number;
}

const catIconMap: Record<string, typeof Coffee> = {
  瓶装饮料: Beer,
  现调饮品: Coffee,
  零食小吃: Cookie,
  简餐: UtensilsCrossed,
};

export default function GoodsList() {
  const navigate = useNavigate();
  const { pushToast, pushLoading, popLoading } = useUIStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<GD.Category[]>([]);
  const [goods, setGoods] = useState<GD.Goods[]>([]);
  const [sessions, setSessions] = useState<SS.Session[]>([]);
  const [activeCatId, setActiveCatId] = useState<number | 0>(0);
  const [cart, setCart] = useState<Map<number, CartItem>>(new Map());
  const [cartOpen, setCartOpen] = useState(false);
  const [sessionId, setSessionId] = useState<number | ''>('');

  const fetchData = async () => {
    setLoading(true);
    pushLoading();
    try {
      const [cats, gs, ss] = await Promise.all([
        get<GD.Category[]>('/goods/categories'),
        get<GD.Goods[]>('/goods', { params: { status: 'on_sale' } }),
        get<SS.Session[]>('/sessions/active'),
      ]);
      setCategories(cats);
      setGoods(gs);
      setSessions(ss);
      if (cats.length > 0) {
        setActiveCatId(0);
      }
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
      popLoading();
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const categoryCounts = useMemo(() => {
    const map = new Map<number, number>();
    goods.forEach((g) => {
      map.set(g.categoryId, (map.get(g.categoryId) || 0) + 1);
    });
    return map;
  }, [goods]);

  const filteredGoods = useMemo(() => {
    if (activeCatId === 0) return goods;
    return goods.filter((g) => g.categoryId === activeCatId);
  }, [goods, activeCatId]);

  const cartItems = useMemo(() => Array.from(cart.values()), [cart]);
  const cartCount = useMemo(
    () => cartItems.reduce((s, i) => s + i.quantity, 0),
    [cartItems]
  );
  const cartTotal = useMemo(
    () => cartItems.reduce((s, i) => s + i.price * i.quantity, 0),
    [cartItems]
  );

  const addToCart = (g: GD.Goods) => {
    if (g.stock <= 0) return;
    setCart((old) => {
      const n = new Map(old);
      const existing = n.get(g.id);
      if (existing) {
        if (existing.quantity >= g.stock) {
          pushToast('库存不足', 'warn');
          return old;
        }
        n.set(g.id, { ...existing, quantity: existing.quantity + 1 });
      } else {
        n.set(g.id, {
          goodsId: g.id,
          name: g.name,
          price: g.price,
          unit: g.unit,
          quantity: 1,
        });
      }
      return n;
    });
  };

  const updateQty = (goodsId: number, delta: number) => {
    setCart((old) => {
      const n = new Map(old);
      const existing = n.get(goodsId);
      if (!existing) return old;
      const newQty = existing.quantity + delta;
      const g = goods.find((x) => x.id === goodsId);
      if (g && newQty > g.stock) {
        pushToast('库存不足', 'warn');
        return old;
      }
      if (newQty <= 0) {
        n.delete(goodsId);
      } else {
        n.set(goodsId, { ...existing, quantity: newQty });
      }
      return n;
    });
  };

  const removeFromCart = (goodsId: number) => {
    setCart((old) => {
      const n = new Map(old);
      n.delete(goodsId);
      return n;
    });
  };

  const handleCheckout = async () => {
    if (cartCount === 0) {
      pushToast('购物车为空', 'warn');
      return;
    }
    if (sessionId === '') {
      pushToast('请选择场次', 'warn');
      return;
    }
    setSubmitting(true);
    pushLoading();
    try {
      for (const item of cartItems) {
        await post(`/sessions/${sessionId}/add-goods`, {
          goodsId: item.goodsId,
          quantity: item.quantity,
        });
      }
      pushToast(`成功加单 ${cartCount} 件商品`, 'success');
      setCart(new Map());
      setCartOpen(false);
      fetchData();
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
      popLoading();
    }
  };

  const getCatIcon = (name: string) => {
    return catIconMap[name] || Package;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="h-8 bg-slate-100 rounded w-40 mb-2" />
            <div className="h-4 bg-slate-100 rounded w-56" />
          </div>
        </div>
        <div className="card p-6 min-h-[500px] flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-primary-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-28">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">商品点单</h1>
          <p className="text-sm text-slate-500 mt-1">商品点单和消费记录</p>
        </div>
        {isAdmin && (
          <button
            className="btn-outline"
            onClick={() => navigate('/goods/manage')}
          >
            <Settings className="w-4 h-4" />
            商品管理
          </button>
        )}
      </div>

      <div className="flex gap-4 flex-col lg:flex-row">
        <aside className="card p-3 lg:w-56 flex-shrink-0">
          <nav className="space-y-1">
            <button
              onClick={() => setActiveCatId(0)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors',
                activeCatId === 0
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              <Package className="w-4 h-4" />
              <span className="flex-1">全部商品</span>
              <span
                className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-semibold',
                  activeCatId === 0
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                {goods.length}
              </span>
            </button>
            {categories.map((c) => {
              const Icon = getCatIcon(c.name);
              const count = categoryCounts.get(c.id) || 0;
              const active = activeCatId === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCatId(c.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span
                    className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-semibold',
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0">
          {filteredGoods.length === 0 ? (
            <div className="card p-16 text-center">
              <Package className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-400">该分类暂无在售商品</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredGoods.map((g) => {
                const soldOut = g.stock <= 0;
                const cartQty = cart.get(g.id)?.quantity || 0;
                return (
                  <div
                    key={g.id}
                    className={cn(
                      'card-hover overflow-hidden group relative',
                      soldOut && 'opacity-60'
                    )}
                  >
                    <div className="aspect-square bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center relative overflow-hidden">
                      {g.image ? (
                        <img
                          src={g.image}
                          alt={g.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : (
                        <Package className="w-16 h-16 text-slate-300" />
                      )}
                      {soldOut && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <span className="bg-red-600 text-white px-4 py-1.5 rounded-lg font-bold text-sm">
                            已售罄
                          </span>
                        </div>
                      )}
                      {!soldOut && cartQty === 0 && (
                        <button
                          onClick={() => addToCart(g)}
                          className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-primary-600 text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all hover:bg-primary-700 active:scale-95"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      )}
                      {!soldOut && cartQty > 0 && (
                        <div className="absolute top-3 right-3 bg-primary-600 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow">
                          {cartQty}
                        </div>
                      )}
                    </div>
                    <div className="p-3 space-y-1.5">
                      <h3 className="font-semibold text-slate-800 text-sm line-clamp-1">
                        {g.name}
                      </h3>
                      <div className="flex items-end justify-between">
                        <div>
                          <span className="text-lg font-bold text-primary-600">
                            {formatMoney(g.price)}
                          </span>
                          <span className="text-xs text-slate-400 ml-1">
                            /{g.unit}
                          </span>
                        </div>
                        <span
                          className={cn(
                            'text-xs',
                            g.stock <= 3 ? 'text-red-500 font-medium' : 'text-slate-400'
                          )}
                        >
                          库存{g.stock}
                        </span>
                      </div>
                      {!soldOut && cartQty > 0 && (
                        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
                          <button
                            onClick={() => updateQty(g.id, -1)}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="font-semibold text-slate-700 text-sm">
                            {cartQty}
                          </span>
                          <button
                            onClick={() => addToCart(g)}
                            className={cn(
                              'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                              cartQty >= g.stock
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-primary-600 hover:bg-primary-700 text-white'
                            )}
                            disabled={cartQty >= g.stock}
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      <div className="fixed bottom-0 left-0 right-0 lg:left-64 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="max-w-[1600px] mx-auto">
          <div
            className={cn(
              'overflow-hidden transition-all duration-300',
              cartOpen ? 'max-h-96' : 'max-h-0'
            )}
          >
            <div className="px-4 py-3 border-b border-slate-100 max-h-72 overflow-y-auto">
              {cartItems.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  <ShoppingCart className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  购物车还是空的
                </div>
              ) : (
                <div className="space-y-2">
                  {cartItems.map((item) => {
                    const g = goods.find((x) => x.id === item.goodsId);
                    const maxStock = g?.stock || 999;
                    return (
                      <div
                        key={item.goodsId}
                        className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-slate-50"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 text-sm truncate">
                            {item.name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {formatMoney(item.price)} x {item.quantity}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 mr-2">
                          <div className="font-semibold text-primary-600 text-sm">
                            {formatMoney(item.price * item.quantity)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={() => updateQty(item.goodsId, -1)}
                            className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center font-semibold text-sm text-slate-700">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQty(item.goodsId, 1)}
                            className={cn(
                              'w-7 h-7 rounded-lg flex items-center justify-center transition-colors',
                              item.quantity >= maxStock
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-primary-600 hover:bg-primary-700 text-white'
                            )}
                            disabled={item.quantity >= maxStock}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeFromCart(item.goodsId)}
                            className="w-7 h-7 rounded-lg text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors ml-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="px-4 py-3 flex items-center gap-4 flex-wrap">
            <button
              onClick={() => cartCount > 0 && setCartOpen((v) => !v)}
              disabled={cartCount === 0}
              className={cn(
                'flex items-center gap-3 transition-colors',
                cartCount > 0 ? 'cursor-pointer' : 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="relative">
                <ShoppingCart
                  className={cn(
                    'w-6 h-6',
                    cartCount > 0 ? 'text-primary-600' : 'text-slate-400'
                  )}
                />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center shadow">
                    {cartCount > 99 ? '99+' : cartCount}
                  </span>
                )}
              </div>
              <div className="text-left">
                <div className="text-sm text-slate-500">
                  已加购 <span className="font-semibold text-slate-700">{cartCount}</span> 件
                </div>
                <div className="text-xs text-slate-400">
                  {cartOpen ? '点击收起明细' : '点击展开明细'}
                </div>
              </div>
              {cartOpen ? (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              )}
            </button>

            <div className="flex-1 min-w-0">
              <div className="text-xs text-slate-500">合计金额</div>
              <div className="text-2xl font-bold text-primary-700">
                {formatMoney(cartTotal)}
              </div>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="min-w-[200px]">
                <select
                  value={sessionId}
                  onChange={(e) =>
                    setSessionId(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="input"
                >
                  <option value="">请选择场次...</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.roomName} - {s.customerName || `场次#${s.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={handleCheckout}
                disabled={cartCount === 0 || sessionId === '' || submitting}
                className={cn(
                  'btn-primary btn-lg min-w-[140px]',
                  (cartCount === 0 || sessionId === '') &&
                    '!bg-slate-300 hover:!bg-slate-300 cursor-not-allowed'
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    加单中...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    确认加单
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
