'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';

interface Order {
  id: string;
  order_number: string;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  public_token: string;
  created_at: string;
  updated_at?: string;
  total_amount?: number;
  currency?: string;
  daily_closure_id?: string | null;
}

interface DailyClosure {
  id: string;
  closed_date: string;
  total_orders: number;
  total_earnings: Record<string, number>;
  created_at: string;
}

export default function DashboardPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [companyName, setCompanyName] = useState<string>('Mi Restaurante');
  const [branchName, setBranchName] = useState<string>('Sede Principal');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  
  const [branding, setBranding] = useState({
    logoUrl: '',
    bgColor: '#f9fafb',
    cardColor: '#ffffff',
    primaryColor: '#111827',
    secondaryColor: '#4b5563',
  });

  const [orders, setOrders] = useState<Order[]>([]);
  const [closures, setClosures] = useState<DailyClosure[]>([]);
  
  const [orderNumber, setOrderNumber] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [currency, setCurrency] = useState('COP');

  const [loading, setLoading] = useState(false);
  const [closingDay, setClosingDay] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [activeQrToken, setActiveQrToken] = useState<string | null>(null);
  const [expandedClosureId, setExpandedClosureId] = useState<string | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('company_id, branch_id')
        .eq('id', user.id)
        .single();

      if (profileData) {
        setCompanyId(profileData.company_id);
        setBranchId(profileData.branch_id);

        const { data: companyData } = await supabase
          .from('companies')
          .select('name')
          .eq('id', profileData.company_id)
          .single();

        if (companyData?.name) setCompanyName(companyData.name);

        const { data: branchData } = await supabase
          .from('branches')
          .select('*')
          .eq('id', profileData.branch_id)
          .single();

        if (branchData) {
          if (branchData.name) setBranchName(branchData.name);
          setBranding({
            logoUrl: branchData.logo_url || '',
            bgColor: branchData.dash_bg_color || '#f9fafb',
            cardColor: branchData.dash_card_color || '#ffffff',
            primaryColor: branchData.dash_primary_color || '#111827',
            secondaryColor: branchData.dash_secondary_color || '#4b5563',
          });
        }

        await fetchOrders(profileData.branch_id);
        await fetchClosures(profileData.branch_id);
      }
      setFetching(false);
    }

    loadInitialData();
  }, [supabase, router]);

  // Realtime order synchronization
  useEffect(() => {
    if (!branchId) return;

    const channel = supabase
      .channel(`realtime_orders_${branchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `branch_id=eq.${branchId}`,
        },
        () => {
          fetchOrders(branchId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchId, supabase]);

  const fetchOrders = async (bId: string) => {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('branch_id', bId)
      .is('daily_closure_id', null)
      .order('created_at', { ascending: false });

    if (data) setOrders(data);
  };

  const fetchClosures = async (bId: string) => {
    const { data } = await supabase
      .from('daily_closures')
      .select('*')
      .eq('branch_id', bId)
      .order('created_at', { ascending: false });

    if (data) setClosures(data as DailyClosure[]);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber || !branchId || !companyId) return;

    setLoading(true);
    const numericAmount = parseFloat(totalAmount) || 0;

    const { data, error } = await supabase
      .from('orders')
      .insert([
        {
          order_number: orderNumber,
          company_id: companyId,
          branch_id: branchId,
          status: 'PREPARING',
          total_amount: numericAmount,
          currency: currency,
        },
      ])
      .select()
      .single();

    if (error) {
      alert(`Error al crear el pedido: ${error.message}`);
    } else if (data) {
      setOrderNumber('');
      setTotalAmount('');
      fetchOrders(branchId);
      setActiveQrToken(data.public_token);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (error) {
      alert(`Error al actualizar estado: ${error.message}`);
    } else if (branchId) {
      fetchOrders(branchId);
    }
  };

  const handleFinalizeDay = async () => {
    if (!branchId || !companyId) return;

    if (deliveredOrders.length === 0 && activeOrders.length === 0) {
      alert('No hay pedidos en la jornada actual para finalizar.');
      return;
    }

    if (activeOrders.length > 0) {
      const proceed = window.confirm(
        `Atención: Hay ${activeOrders.length} pedido(s) aún en preparación o listos para entregar.\n\n¿Deseas archivar la jornada de todos modos?`
      );
      if (!proceed) return;
    }

    const confirmClose = window.confirm(
      `¿Estás seguro de finalizar el día?\n\n- Pedidos completados: ${deliveredOrders.length}\n- Se archivará la jornada y la pantalla se reiniciará.`
    );

    if (!confirmClose) return;

    setClosingDay(true);
    
    const now = new Date();
    const todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const { data: closureData, error: closureError } = await supabase
      .from('daily_closures')
      .insert([
        {
          company_id: companyId,
          branch_id: branchId,
          closed_date: todayDateStr,
          total_orders: deliveredOrders.length,
          total_earnings: earningsByCurrency,
        },
      ])
      .select()
      .single();

    if (closureError || !closureData) {
      alert('Error al cerrar la jornada. Por favor reintenta.');
      setClosingDay(false);
      return;
    }

    const currentOrderIds = orders.map((o) => o.id);
    if (currentOrderIds.length > 0) {
      await supabase
        .from('orders')
        .update({ daily_closure_id: closureData.id })
        .in('id', currentOrderIds);
    }

    await fetchOrders(branchId);
    await fetchClosures(branchId);
    setClosingDay(false);
    alert('¡Jornada finalizada exitosamente! Se ha guardado en el historial.');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const getBaseUrl = () => {
    if (typeof window !== 'undefined') return window.location.origin;
    return '';
  };

  const formatMoney = (amount: number = 0, curr: string = 'COP') => {
    const localeMap: Record<string, string> = {
      COP: 'es-CO',
      USD: 'en-US',
      EUR: 'de-DE',
    };
    return new Intl.NumberFormat(localeMap[curr] || 'es-CO', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: curr === 'COP' ? 0 : 2,
    }).format(amount);
  };

  const formatDateLabel = (dateString: string) => {
    if (!dateString) return '';
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const date = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return date.toLocaleDateString('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    return dateString;
  };

  const activeOrders = orders.filter((o) => o.status !== 'DELIVERED' && o.status !== 'CANCELLED');
  const deliveredOrders = orders.filter((o) => o.status === 'DELIVERED');

  const earningsByCurrency = deliveredOrders.reduce<Record<string, number>>((acc, order) => {
    const curr = order.currency || 'COP';
    const amount = Number(order.total_amount) || 0;
    acc[curr] = (acc[curr] || 0) + amount;
    return acc;
  }, {});

  if (fetching) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-black">
        <p className="text-sm font-semibold">Cargando panel...</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-6 md:p-10 transition-colors duration-300"
      style={{ backgroundColor: branding.bgColor }}
    >
      {/* Header */}
      <div className="mx-auto max-w-5xl flex items-center justify-between mb-8 pb-4 border-b border-gray-200/50">
        <div className="flex items-center gap-4">
          {branding.logoUrl && (
            <img
              src={branding.logoUrl}
              alt="Logo"
              className="h-14 w-14 object-contain rounded-xl border border-gray-200 bg-white p-1 shadow-sm"
            />
          )}
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
              {companyName}
            </span>
            <h1 className="text-2xl font-black" style={{ color: branding.primaryColor }}>
              {branchName}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: branding.secondaryColor }}>
              Gestión de turnos y beepers digitales
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/settings"
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-black hover:bg-gray-100 transition-colors shadow-sm"
          >
            ⚙️ Ajustes y Logo
          </Link>
          <button
            onClick={handleLogout}
            className="rounded-lg bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-500 transition-colors shadow-sm"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Columna Izquierda */}
        <div className="md:col-span-1 space-y-6">
          <div
            className="rounded-xl p-6 shadow-sm border border-gray-200/80"
            style={{ backgroundColor: branding.cardColor }}
          >
            <h2 className="text-lg font-black mb-4" style={{ color: branding.primaryColor }}>
              Nuevo Pedido
            </h2>
            <form onSubmit={handleCreateOrder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: branding.primaryColor }}>
                  Número o Código de Pedido
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder="Ej. #104 o Beeper 12"
                  required
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black font-bold placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-bold mb-1" style={{ color: branding.primaryColor }}>
                    Valor del Pedido
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-black font-bold placeholder:text-gray-400 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: branding.primaryColor }}>
                    Moneda
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-black font-extrabold focus:border-blue-600 focus:outline-none"
                  >
                    <option value="COP">COP</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors mt-2 shadow-sm"
              >
                {loading ? 'Generando...' : 'Crear Beeper Digital'}
              </button>
            </form>
          </div>

          <div className="rounded-xl bg-gradient-to-br from-gray-900 to-slate-800 p-5 text-white shadow-sm border border-gray-700">
            <h3 className="text-sm font-bold mb-1 flex items-center gap-2">
              <span>🏁</span> Cierre de Jornada
            </h3>
            <p className="text-xs text-gray-300 mb-4">
              Archiva los pedidos de hoy y reinicia la pantalla para la siguiente jornada.
            </p>
            <button
              onClick={handleFinalizeDay}
              disabled={closingDay}
              className="w-full rounded-lg bg-red-600 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-red-500 disabled:opacity-50 transition-all border border-red-500 shadow-md"
            >
              {closingDay ? 'Guardando día...' : 'FINALIZAR DÍA'}
            </button>
          </div>

          <div
            className="rounded-xl p-6 shadow-sm border border-gray-200/80"
            style={{ backgroundColor: branding.cardColor }}
          >
            <h2 className="text-base font-bold mb-3 flex items-center gap-2" style={{ color: branding.primaryColor }}>
              <span>📅</span> Historial de Días
            </h2>

            {closures.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-4">
                Aún no has registrado cierres de jornada.
              </p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {closures.map((c) => {
                  const isExpanded = expandedClosureId === c.id;
                  const earningsEntries = Object.entries(c.total_earnings || {});

                  return (
                    <div
                      key={c.id}
                      className="rounded-lg border border-gray-200 bg-gray-50/70 overflow-hidden text-xs"
                    >
                      <button
                        onClick={() => setExpandedClosureId(isExpanded ? null : c.id)}
                        className="w-full p-3 flex items-center justify-between text-left hover:bg-gray-100 transition-colors"
                      >
                        <div>
                          <p className="font-bold text-black capitalize">
                            {formatDateLabel(c.closed_date)}
                          </p>
                          <p className="text-[11px] text-gray-600 mt-0.5">
                            {c.total_orders} pedidos completados
                          </p>
                        </div>
                        <span className="text-gray-500 font-bold text-sm">
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="p-3 bg-white border-t border-gray-200 space-y-2">
                          <p className="font-bold text-black text-[11px] uppercase tracking-wider">
                            Ganancias Recaudadas:
                          </p>
                          {earningsEntries.length === 0 ? (
                            <p className="text-gray-400 text-[11px]">$0</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {earningsEntries.map(([curr, total]) => (
                                <span
                                  key={curr}
                                  className="inline-flex items-center gap-1 bg-green-50 border border-green-200 text-green-900 font-bold px-2 py-0.5 rounded text-[11px]"
                                >
                                  {formatMoney(total as number, curr)}
                                  <span className="text-[9px] bg-green-200 px-1 rounded uppercase font-black">
                                    {curr}
                                  </span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Columna Derecha */}
        <div className="md:col-span-2 space-y-8">
          <div
            className="rounded-xl p-6 shadow-sm border border-gray-200/80"
            style={{ backgroundColor: branding.cardColor }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black" style={{ color: branding.primaryColor }}>
                Pedidos en Pantalla
              </h2>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-900">
                {activeOrders.length} activos
              </span>
            </div>

            {activeOrders.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">No hay pedidos pendientes en este momento.</p>
            ) : (
              <div className="space-y-3">
                {activeOrders.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between p-4 rounded-lg border border-gray-200 bg-gray-50/70 hover:bg-white transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-black">Pedido #{o.order_number}</span>
                        {o.total_amount !== undefined && o.total_amount !== null ? (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-900 bg-gray-200 px-2 py-0.5 rounded">
                            {formatMoney(o.total_amount, o.currency || 'COP')}
                            <span className="text-[10px] text-gray-700 font-black uppercase">
                              {o.currency || 'COP'}
                            </span>
                          </span>
                        ) : null}
                      </div>

                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`inline-block px-2.5 py-0.5 text-xs font-bold rounded-full ${
                            o.status === 'PREPARING'
                              ? 'bg-yellow-100 text-yellow-900 border border-yellow-200'
                              : 'bg-green-100 text-green-900 border border-green-200'
                          }`}
                        >
                          {o.status === 'PREPARING' ? 'En Preparación' : '¡LISTO PARA RETIRAR!'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setActiveQrToken(o.public_token)}
                        className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-bold text-black hover:bg-gray-100 shadow-sm"
                      >
                        Mostrar QR
                      </button>

                      {o.status === 'PREPARING' ? (
                        <button
                          onClick={() => handleUpdateStatus(o.id, 'READY')}
                          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-500 shadow-sm"
                        >
                          Notificar (LISTO)
                        </button>
                      ) : (
                        <button
                          onClick={() => handleUpdateStatus(o.id, 'DELIVERED')}
                          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-gray-800 shadow-sm"
                        >
                          Marcar Entregado
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div
            className="rounded-xl p-6 shadow-sm border border-gray-200/80"
            style={{ backgroundColor: branding.cardColor }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-lg font-black" style={{ color: branding.primaryColor }}>
                  Entregados Exitosamente
                </h2>
                <p className="text-xs" style={{ color: branding.secondaryColor }}>
                  {deliveredOrders.length} pedidos en esta jornada
                </p>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs font-bold text-gray-700">Jornada actual:</span>
                {Object.keys(earningsByCurrency).length === 0 ? (
                  <span className="text-xs font-bold text-gray-400">$0</span>
                ) : (
                  Object.entries(earningsByCurrency).map(([curr, total]) => (
                    <span
                      key={curr}
                      className="inline-flex items-center gap-1 rounded-lg bg-green-100 border border-green-300 px-2.5 py-1 text-xs font-black text-green-900"
                    >
                      {formatMoney(total, curr)}
                      <span className="text-[10px] bg-green-200 px-1 rounded uppercase font-black">
                        {curr}
                      </span>
                    </span>
                  ))
                )}
              </div>
            </div>

            {deliveredOrders.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 text-center">Aún no has marcado pedidos como entregados en esta jornada.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {deliveredOrders.map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-green-200 bg-green-50/50"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white text-xs font-bold">
                        ✓
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-black">Pedido #{o.order_number}</span>
                        {o.total_amount !== undefined && o.total_amount !== null ? (
                          <span className="inline-flex items-center gap-1 text-xs font-extrabold text-green-900 bg-green-200 px-2 py-0.5 rounded">
                            {formatMoney(o.total_amount, o.currency || 'COP')}
                            <span className="text-[10px] bg-green-300 px-1 py-0.2 rounded font-black uppercase">
                              {o.currency || 'COP'}
                            </span>
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <span className="text-xs text-green-800 font-extrabold bg-green-100 px-2.5 py-0.5 rounded-full border border-green-200">
                      Entregado
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {activeQrToken && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 p-4 z-50">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl">
            <h3 className="text-lg font-black text-black mb-2">Escanea tu Beeper Digital</h3>
            <p className="text-xs text-gray-600 mb-6">Muestra este código al cliente para abrir su turno</p>
            
            <div className="flex justify-center bg-gray-50 p-4 rounded-xl border border-gray-200">
              <QRCodeSVG value={`${getBaseUrl()}/order/${activeQrToken}`} size={200} />
            </div>

            <button
              onClick={() => setActiveQrToken(null)}
              className="mt-6 w-full rounded-lg bg-black py-2.5 text-sm font-bold text-white hover:bg-gray-800"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}