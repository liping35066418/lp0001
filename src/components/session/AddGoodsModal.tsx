import { useState, useEffect, useMemo } from 'react';
import { X, Plus, Minus, ShoppingCart, Package, Search } from 'lucide-react';
import { get, post } from '@/utils/api';
import { useUIStore } from '@/store/ui';
import type { Goods, Session } from '../../../shared/api-types';
import { formatMoney } from '@/utils/format';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  session: Session.SessionDetail | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddGoodsModal({
  open,
  session,
  onClose,
  onSuccess,
}: Props) {
  const pushToast = useUIStore((s) => s.pushToast);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [categories, setCategories] = useState<Goods.Category[]>([]);
  const [goods, setGoods] = useState<Goods.Goods[]>([]);
  const [activeCategory, setActiveCategory] = useState<number | 'all'>('all');
  const [keyword, setKeyword] = useState('');
  const [cart, setCart] = useState<Record<number, number>>({});

  useEffect(() => {
    if (open) {
      fetchData();
      setCart({});
      setKeyword('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [cats, list] = await Promise.all([
        get<Goods.Category[]>('/goods/categories'),
        get<Goods.Goods[]>('/goods'),
      ]);
      setCategories(cats);
      setGoods(list.filter((g) => g.status === 'on_sale'));
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = goods;
    if (activeCategory !== 'all') {
      list = list.filter((g) => g.categoryId === activeCategory);
    }
    if (keyword.trim()) {
      const k = keyword.trim().toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(k));
    }
    return list;
  }, [goods, activeCategory, keyword]);

  const cartItems = useMemo(() => {
    const items: { goods: Goods.Goods; qty: number }[] = [];
    Object.entries(cart).forEach(([id, qty]) => {
      if (qty > 0) {
        const g = goods.find((x) => x.id === Number(id));
        if (g) items.push({ goods: g, qty });
      }
    });
    return items;
  }, [cart, goods]);

  const cartTotal = cartItems.reduce(
    (sum, it) => sum + it.goods.price * it.qty,
    0
  );
  const cartCount = cartItems.reduce((sum, it) => sum + it.qty, 0);

  const updateQty = (id: number, delta: number) => {
    setCart((prev) => {
      const current = prev[id] || 0;
      const g = goods.find((x) => x.id === id);
      const max = g?.stock || 999;
      const next = Math.max(0, Math.min(max, current + delta));
      return { ...prev, [id]: next };
    });
  };

  const handleSubmit = async () => {
    if (cartCount === 0 || !session) {
      pushToast('请先选择商品', 'warn');
      return;
    }
    setSubmitting(true);
    try {
      await Promise.all(
        cartItems.map((it) =>
          post(`/sessions/${session.id}/goods`, {
            goodsId: it.goods.id,
            quantity: it.qty,
          })
        )
      );
      pushToast(`成功添加 ${cartCount} 件商品！`, 'success');
      onSuccess();
      onClose();
    } catch (e) {
      pushToast((e as Error).message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal !max-w-4xl animate-slide-up flex flex-col"
        style={{ maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header flex-shrink-0">
          <div className="flex items-center gap-3">
            <ShoppingCart size={20} className="text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-800">
              商品点单
            </h2>
            <span className="text-sm text-slate-400">
              {session?.roomName} · #{session?.id}
            </span>
          </div>
          <button className="btn-sm btn-ghost" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-hidden flex">
          <div className="w-40 border-r border-slate-100 overflow-y-auto py-2 flex-shrink-0">
            <button
              onClick={() => setActiveCategory('all')}
              className={cn(
                'w-full px-4 py-2.5 text-left text-sm transition-colors',
                activeCategory === 'all'
                  ? 'bg-primary-50 text-primary-700 font-medium border-r-2 border-primary-600'
                  : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              全部商品
              <span className="text-xs text-slate-400 ml-1">
                ({goods.length})
              </span>
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={cn(
                  'w-full px-4 py-2.5 text-left text-sm transition-colors',
                  activeCategory === c.id
                    ? 'bg-primary-50 text-primary-700 font-medium border-r-2 border-primary-600'
                    : 'text-slate-600 hover:bg-slate-50'
                )}
              >
                {c.name}
                <span className="text-xs text-slate-400 ml-1">
                  ({goods.filter((g) => g.categoryId === c.id).length})
                </span>
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-hidden flex flex-col min-w-0">
            <div className="p-3 border-b border-slate-100 flex-shrink-0">
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  className="input pl-9"
                  placeholder="搜索商品名称..."
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="h-28 bg-slate-100 rounded-lg animate-pulse-soft"
                    />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-slate-400">
                  <Package size={40} className="mb-2 opacity-40" />
                  <p className="text-sm">暂无商品</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {filtered.map((g) => {
                    const qty = cart[g.id] || 0;
                    const outOfStock = g.stock <= 0;
                    return (
                      <div
                        key={g.id}
                        className={cn(
                          'p-3 rounded-lg border transition-all',
                          outOfStock
                            ? 'bg-slate-50 border-slate-100 opacity-60'
                            : qty > 0
                            ? 'bg-primary-50 border-primary-200'
                            : 'bg-white border-slate-200 hover:border-primary-300 hover:shadow-sm'
                        )}
                      >
                        <div className="aspect-video bg-slate-100 rounded-md mb-2 flex items-center justify-center text-slate-300 overflow-hidden">
                          {g.image ? (
                            <img
                              src={g.image}
                              alt={g.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package size={24} />
                          )}
                        </div>
                        <div className="text-sm font-medium text-slate-800 truncate mb-1">
                          {g.name}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-accent-600 font-bold text-sm">
                            {formatMoney(g.price)}
                          </span>
                          <span className="text-xs text-slate-400">
                            库存 {g.stock}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-end">
                          {qty === 0 ? (
                            <button
                              disabled={outOfStock}
                              onClick={() => updateQty(g.id, 1)}
                              className={cn(
                                'btn-sm',
                                outOfStock
                                  ? 'btn-ghost text-slate-400 cursor-not-allowed'
                                  : 'btn-primary'
                              )}
                            >
                              <Plus size={14} />
                              添加
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 bg-white rounded-lg border border-slate-200 px-1 py-0.5">
                              <button
                                className="p-1 text-slate-500 hover:text-primary-600"
                                onClick={() => updateQty(g.id, -1)}
                              >
                                <Minus size={14} />
                              </button>
                              <span className="w-6 text-center text-sm font-medium tabular-nums">
                                {qty}
                              </span>
                              <button
                                disabled={qty >= g.stock}
                                className={cn(
                                  'p-1',
                                  qty >= g.stock
                                    ? 'text-slate-300 cursor-not-allowed'
                                    : 'text-slate-500 hover:text-primary-600'
                                )}
                                onClick={() => updateQty(g.id, 1)}
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="w-64 border-l border-slate-100 flex flex-col bg-slate-50/50 flex-shrink-0">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <ShoppingCart size={16} className="text-primary-600" />
                已选商品
                <span className="badge bg-primary-100 text-primary-700">
                  {cartCount}
                </span>
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                  <ShoppingCart size={32} className="mb-2 opacity-30" />
                  <p className="text-xs">购物车是空的</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {cartItems.map(({ goods: g, qty }) => (
                    <div
                      key={g.id}
                      className="p-2 bg-white rounded-lg border border-slate-100"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm text-slate-800 flex-1 truncate">
                          {g.name}
                        </span>
                        <button
                          className="text-slate-400 hover:text-red-500 p-0.5"
                          onClick={() => setCart((p) => ({ ...p, [g.id]: 0 }))}
                        >
                          <X size={12} />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            className="p-0.5 text-slate-500 hover:text-primary-600"
                            onClick={() => updateQty(g.id, -1)}
                          >
                            <Minus size={12} />
                          </button>
                          <span className="w-5 text-center text-xs tabular-nums">
                            {qty}
                          </span>
                          <button
                            disabled={qty >= g.stock}
                            className={cn(
                              'p-0.5',
                              qty >= g.stock
                                ? 'text-slate-300'
                                : 'text-slate-500 hover:text-primary-600'
                            )}
                            onClick={() => updateQty(g.id, 1)}
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                        <span className="text-sm font-medium text-accent-600 tabular-nums">
                          {formatMoney(g.price * qty)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-100 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500">合计金额</span>
                <span className="text-xl font-bold text-accent-600 tabular-nums">
                  {formatMoney(cartTotal)}
                </span>
              </div>
              <button
                disabled={cartCount === 0 || submitting}
                onClick={handleSubmit}
                className={cn(
                  'btn-primary w-full justify-center',
                  (cartCount === 0 || submitting) &&
                    'opacity-50 cursor-not-allowed'
                )}
              >
                <ShoppingCart size={16} />
                {submitting ? '添加中...' : `确认添加 (${cartCount})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
