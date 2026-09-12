'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface OrderRow {
  id: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  ready_at: string | null;
  delivered_at: string | null;
}

interface ItemRow {
  product_name: string;
  quantity: number;
  subtotal: number;
  currency: string | null;
}

type RangeOption = 'today' | '7d' | '30d';

export default function StatsPage() {
  const [branchId, setBranchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeOption>('today');

  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);

  const [branding, setBranding] = useState({
    bgColor: '#f9fafb',
    cardColor: '#ffffff',
    primaryColor: '#111827',
    secondaryColor: '#4b5563',
  });

  const supabase = createClient();
  const router = useRouter();

  const getRangeStart = (r: RangeOption): Date => {
    const now = new Date();
    if (r === 'today') {
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
    if (r === '7d') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return d;
    }
    const d = new Date(now);
    d.setDate(d.getDate() - 30);
    return d;
  };

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('branch_id')
        .eq('id', user.id)
        .single();

      if (profile?.branch_id) {
        setBranchId(profile.branch_id);

        const { data: branchData } = await supabase
          .from('branches')
          .select('dash_bg_color, dash_card_color, dash_primary_color, dash_secondary_color')
          .eq('id', profile.branch_id)
          .single();

        if (branchData) {
          setBranding({
            bgColor: branchData.dash_bg_color || '#f9fafb',
            cardColor: branchData.dash_card_color || '#ffffff',
            primaryColor: branchData.dash_primary_color || '#111827',
            secondaryColor: branchData.dash_secondary_color || '#4b5563',
          });
        }
      }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (!branchId) return;
    fetchStats(branchId, range);
  }, [branchId, range]);

  const fetchStats = async (bId: string, r: RangeOption) => {
    const rangeStart = getRangeStart(r).toISOString();

    const { data: ordersData } = await supabase
      .from('orders')
      .select('id, status, total_amount, currency, created_at, ready_at, delivered_at')
      .eq('branch_id', bId)
      .gte('created_at', rangeStart);

    if (ordersData) setOrders(ordersData);

    const orderIds = (ordersData || []).map((o) => o.id);
    if (orderIds.length === 0) {
      setItems([]);
      return;
    }

    const { data: itemsData } = await supabase
      .from('order_items')
      .select('product_name, quantity, subtotal, orders!inner(currency)')
      .in('order_id', orderIds);

    if (itemsData) {
      setItems(
        itemsData.map((i) => ({
          product_name: i.product_name,
          quantity: i.quantity,
          subtotal: i.subtotal,
          currency: (i as unknown as { orders: { currency: string } }).orders?.currency || null,
        }))
      );
    }
  };

  const formatMoney = (amount: number, curr: string) => {
    const localeMap: Record<string, string> = { COP: 'es-CO', USD: 'en-US', EUR: 'de-DE' };
    return new Intl.NumberFormat(localeMap[curr] || 'es-CO', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: curr === 'COP' ? 0 : 2,
    }).format(amount);
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 1) return '< 1 min';
    if (minutes < 60) return `${Math.round(minutes)} min`;
    const h = Math.floor(minutes / 60);
    const m = Math.round(minutes % 60);
    return `${h}h ${m}min`;
  };

  // --- Cálculos ---
  const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED');
  const cancelledCount = orders.filter((o) => o.status === 'CANCELLED').length;

  const revenueByCurrency = deliveredOrders.reduce<Record<string, number>>((acc, o) => {
    const curr = o.currency || 'COP';
    acc[curr] = (acc[curr] || 0) + (o.total_amount || 0);
    return acc;
  }, {});

  const prepTimes = orders
    .filter((o) => o.ready_at)
    .map((o) => (new Date(o.ready_at as string).getTime() - new Date(o.created_at).getTime()) / 60000);
  const avgPrepTime = prepTimes.length > 0 ? prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length : null;

  const productTotals = items.reduce<Record<string, { qty: number; revenue: number; currency: string }>>(
    (acc, item) => {
      if (!acc[item.product_name]) {
        acc[item.product_name] = { qty: 0, revenue: 0, currency: item.currency || 'COP' };
      }
      acc[item.product_name].qty += item.quantity;
      acc[item.product_name].revenue += item.subtotal;
      return acc;
    },
    {}
  );

  const productList = Object.entries(productTotals)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.qty - a.qty);

  const topProducts = productList.slice(0, 5);
  const bottomProducts = [...productList].reverse().slice(0, 5);
  const maxQty = topProducts[0]?.qty || 1;

  // Ingresos por día (para la gráfica de barras simple)
  const revenueByDay = deliveredOrders.reduce<Record<string, number>>((acc, o) => {
    const day = new Date(o.created_at).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' });
    acc[day] = (acc[day] || 0) + (o.total_amount || 0);
    return acc;
  }, {});
  const dayEntries = Object.entries(revenueByDay);
  const maxDayRevenue = Math.max(...dayEntries.map(([, v]) => v), 1);

  const rangeLabels: Record<RangeOption, string> = {
    today: 'Hoy',
    '7d': 'Últimos 7 días',
    '30d': 'Últimos 30 días',
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-black">
        <p className="text-sm font-semibold">Cargando estadísticas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ backgroundColor: branding.bgColor }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <Link href="/dashboard" className="text-xs font-bold text-blue-600 hover:underline mb-1 inline-block">
              ← Volver al Panel
            </Link>
            <h1 className="text-2xl font-black" style={{ color: branding.primaryColor }}>
              📊 Estadísticas
            </h1>
          </div>

          <div className="flex gap-2">
            {(['today', '7d', '30d'] as RangeOption[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-2 text-xs font-bold border ${
                  range === r
                    ? 'text-white'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                style={range === r ? { backgroundColor: branding.primaryColor, borderColor: branding.primaryColor } : undefined}
              >
                {rangeLabels[r]}
              </button>
            ))}
          </div>
        </div>

        {/* Tarjetas resumen */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl p-4 shadow-sm border border-gray-200" style={{ backgroundColor: branding.cardColor }}>
            <p className="text-[11px] font-bold" style={{ color: branding.secondaryColor }}>Pedidos</p>
            <p className="text-2xl font-black" style={{ color: branding.primaryColor }}>{orders.length}</p>
          </div>
          <div className="rounded-xl p-4 shadow-sm border border-gray-200" style={{ backgroundColor: branding.cardColor }}>
            <p className="text-[11px] font-bold" style={{ color: branding.secondaryColor }}>Entregados</p>
            <p className="text-2xl font-black" style={{ color: branding.primaryColor }}>{deliveredOrders.length}</p>
          </div>
          <div className="rounded-xl p-4 shadow-sm border border-gray-200" style={{ backgroundColor: branding.cardColor }}>
            <p className="text-[11px] font-bold" style={{ color: branding.secondaryColor }}>Tiempo prom. prep.</p>
            <p className="text-2xl font-black" style={{ color: branding.primaryColor }}>
              {avgPrepTime !== null ? formatDuration(avgPrepTime) : '—'}
            </p>
          </div>
          <div className="rounded-xl p-4 shadow-sm border border-gray-200" style={{ backgroundColor: branding.cardColor }}>
            <p className="text-[11px] font-bold" style={{ color: branding.secondaryColor }}>Cancelados</p>
            <p className="text-2xl font-black" style={{ color: branding.primaryColor }}>{cancelledCount}</p>
          </div>
        </div>

        {/* Ingresos */}
        <div className="rounded-xl p-5 shadow-sm border border-gray-200" style={{ backgroundColor: branding.cardColor }}>
          <h2 className="text-sm font-bold mb-2" style={{ color: branding.primaryColor }}>💰 Ingresos ({rangeLabels[range]})</h2>
          {Object.keys(revenueByCurrency).length === 0 ? (
            <p className="text-xs" style={{ color: branding.secondaryColor }}>Sin ventas entregadas todavía en este rango.</p>
          ) : (
            <div className="flex gap-4 flex-wrap">
              {Object.entries(revenueByCurrency).map(([curr, total]) => (
                <p key={curr} className="text-xl font-black" style={{ color: branding.primaryColor }}>
                  {formatMoney(total, curr)}
                </p>
              ))}
            </div>
          )}
        </div>

        {/* Gráfica simple de ingresos por día */}
        {dayEntries.length > 1 && (
          <div className="rounded-xl p-5 shadow-sm border border-gray-200" style={{ backgroundColor: branding.cardColor }}>
            <h2 className="text-base font-bold mb-5" style={{ color: branding.primaryColor }}>📈 Ingresos por día</h2>
            <div className="flex items-stretch gap-4 h-64">
              {dayEntries.map(([day, value]) => (
                <div key={day} className="flex-1 flex flex-col justify-end items-center gap-2 h-full">
                  <span className="text-xs font-black whitespace-nowrap" style={{ color: branding.primaryColor }}>
                    {formatMoney(value, 'COP')}
                  </span>
                  <div
                    className="w-full rounded-t-lg min-h-[8px] shadow-sm"
                    style={{
                      height: `${Math.max((value / maxDayRevenue) * 100, 3)}%`,
                      backgroundColor: branding.primaryColor,
                    }}
                  />
                  <span className="text-xs font-bold whitespace-nowrap" style={{ color: branding.secondaryColor }}>{day}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Productos más y menos vendidos */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl p-5 shadow-sm border border-gray-200" style={{ backgroundColor: branding.cardColor }}>
            <h2 className="text-sm font-bold mb-3" style={{ color: branding.primaryColor }}>🏆 Más vendidos</h2>
            {topProducts.length === 0 ? (
              <p className="text-xs" style={{ color: branding.secondaryColor }}>Sin datos en este rango.</p>
            ) : (
              <div className="space-y-2">
                {topProducts.map((p) => (
                  <div key={p.name}>
                    <div className="flex justify-between text-xs font-bold mb-0.5" style={{ color: branding.primaryColor }}>
                      <span className="truncate">{p.name}</span>
                      <span>{p.qty}</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${(p.qty / maxQty) * 100}%`, backgroundColor: branding.primaryColor }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl p-5 shadow-sm border border-gray-200" style={{ backgroundColor: branding.cardColor }}>
            <h2 className="text-sm font-bold mb-3" style={{ color: branding.primaryColor }}>📉 Menos vendidos</h2>
            {bottomProducts.length === 0 ? (
              <p className="text-xs" style={{ color: branding.secondaryColor }}>Sin datos en este rango.</p>
            ) : (
              <div className="space-y-1.5">
                {bottomProducts.map((p) => (
                  <div key={p.name} className="flex justify-between text-xs font-bold" style={{ color: branding.secondaryColor }}>
                    <span className="truncate">{p.name}</span>
                    <span>{p.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}