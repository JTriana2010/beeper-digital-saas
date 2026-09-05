'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface BranchInfo {
  name: string;
  logo_url: string | null;
  bg_color: string;
  client_card_color: string;
  primary_color: string;
  secondary_color: string;
}

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
}

interface TableOption {
  id: string;
  name: string;
}

interface CartLine {
  product_id: string;
  name: string;
  unit_price: number;
  currency: string;
  quantity: number;
}

export default function PublicMenuPage() {
  const params = useParams();
  const router = useRouter();
  const branchId = params.branchId as string;

  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<TableOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [tableTouched, setTableTouched] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const alreadySentRef = useRef(false);

  const supabase = createClient();

  useEffect(() => {
    async function load() {
      if (!branchId) return;

      const { data: branchData, error: branchError } = await supabase
        .from('branches')
        .select('name, logo_url, bg_color, client_card_color, primary_color, secondary_color')
        .eq('id', branchId)
        .single();

      if (branchError || !branchData) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setBranch(branchData);

      const { data: categoriesData } = await supabase
        .from('categories')
        .select('id, name, sort_order')
        .eq('branch_id', branchId)
        .order('sort_order', { ascending: true });
      if (categoriesData) setCategories(categoriesData);

      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .eq('branch_id', branchId)
        .eq('is_available', true)
        .order('sort_order', { ascending: true });
      if (productsData) setProducts(productsData);

      const { data: tablesData } = await supabase
        .from('tables')
        .select('id, name')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });
      if (tablesData) setTables(tablesData);

      setLoading(false);
    }
    load();
  }, [branchId]);

  const formatMoney = (amount: number, curr: string) => {
    const localeMap: Record<string, string> = { COP: 'es-CO', USD: 'en-US', EUR: 'de-DE' };
    return new Intl.NumberFormat(localeMap[curr] || 'es-CO', {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: curr === 'COP' ? 0 : 2,
    }).format(amount);
  };

  const getQuantityInCart = (productId: string) =>
    cart.find((c) => c.product_id === productId)?.quantity || 0;

  const handleAdd = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          name: product.name,
          unit_price: product.price,
          currency: product.currency,
          quantity: 1,
        },
      ];
    });
  };

  const handleRemove = (productId: string) => {
    setCart((prev) =>
      prev
        .map((c) => (c.product_id === productId ? { ...c, quantity: c.quantity - 1 } : c))
        .filter((c) => c.quantity > 0)
    );
  };

  const cartTotal = cart.reduce((sum, c) => sum + c.unit_price * c.quantity, 0);
  const cartCount = cart.reduce((sum, c) => sum + c.quantity, 0);
  const cartCurrency = cart[0]?.currency || 'COP';

  const handleGoToConfirm = () => {
    let blocked = false;
    if (!selectedTableId) {
      setTableTouched(true);
      blocked = true;
    }
    if (!customerName.trim()) {
      setNameTouched(true);
      blocked = true;
    }
    if (blocked) return;
    setConfirming(true);
  };

  const handleSendOrder = async () => {
    // Bloqueo inmediato: si ya se está enviando (o ya se envió), no
    // hacemos nada más, sin importar cuántas veces le hagan clic.
    if (alreadySentRef.current) return;
    alreadySentRef.current = true;

    setSubmitting(true);
    setSubmitError('');

    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchId,
          tableId: selectedTableId,
          customerName: customerName.trim(),
          items: cart.map((c) => ({ productId: c.product_id, quantity: c.quantity })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitError(data.error || 'No se pudo enviar el pedido.');
        setSubmitting(false);
        alreadySentRef.current = false; // si falló, sí puede intentar de nuevo
        return;
      }

      router.push(`/order/${data.publicToken}`);
    } catch {
      setSubmitError('Error de conexión. Intenta de nuevo.');
      setSubmitting(false);
      alreadySentRef.current = false;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm font-semibold text-gray-600">Cargando carta...</p>
      </div>
    );
  }

  if (notFound || !branch) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6 text-center">
        <p className="text-sm font-semibold text-gray-600">
          No encontramos esta carta. Verifica el código QR o el link.
        </p>
      </div>
    );
  }

  const bgColor = branch.bg_color || '#f9fafb';
  const cardColor = branch.client_card_color || '#ffffff';
  const primaryColor = branch.primary_color || '#111827';
  const secondaryColor = branch.secondary_color || '#4b5563';
  const selectedTable = tables.find((t) => t.id === selectedTableId);

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor, paddingBottom: cartCount > 0 ? '96px' : '48px' }}>
      {/* Encabezado */}
      <div className="px-6 pt-10 pb-6 text-center">
        {branch.logo_url && (
          <img
            src={branch.logo_url}
            alt={branch.name}
            className="mx-auto h-16 w-16 rounded-full object-cover border-2 border-white shadow-md mb-3"
          />
        )}
        <h1 className="text-2xl font-black" style={{ color: primaryColor }}>
          {branch.name}
        </h1>
        <p className="text-xs mt-1" style={{ color: secondaryColor }}>
          Carta Digital
        </p>
      </div>

      {/* Navegación rápida entre categorías */}
      {categories.length > 1 && (
        <div className="px-4 mb-4 flex gap-2 overflow-x-auto pb-1">
          {categories.map((cat) => (
            <a
              key={cat.id}
              href={`#cat-${cat.id}`}
              className="flex-shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold whitespace-nowrap"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              {cat.name}
            </a>
          ))}
        </div>
      )}

      {/* Categorías y productos */}
      <div className="mx-auto max-w-2xl px-4 space-y-6">
        {categories.length === 0 ? (
          <p className="text-center text-sm py-10" style={{ color: secondaryColor }}>
            Este restaurante aún no ha publicado su carta.
          </p>
        ) : (
          categories.map((cat) => {
            const catProducts = products.filter((p) => p.category_id === cat.id);
            if (catProducts.length === 0) return null;

            return (
              <div key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-4">
                <h2 className="text-lg font-black mb-3" style={{ color: primaryColor }}>
                  {cat.name}
                </h2>
                <div className="space-y-3">
                  {catProducts.map((p) => {
                    const qty = getQuantityInCart(p.id);
                    return (
                      <div
                        key={p.id}
                        className="rounded-xl p-4 shadow-sm border border-black/5 flex gap-3"
                        style={{ backgroundColor: cardColor }}
                      >
                        {p.image_url && (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="h-16 w-16 rounded-lg object-cover flex-shrink-0"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-bold" style={{ color: primaryColor }}>
                              {p.name}
                            </h3>
                            <span className="text-sm font-black flex-shrink-0" style={{ color: primaryColor }}>
                              {formatMoney(p.price, p.currency)}
                            </span>
                          </div>
                          {p.description && (
                            <p className="text-xs mt-1" style={{ color: secondaryColor }}>
                              {p.description}
                            </p>
                          )}

                          <div className="mt-2 flex justify-end">
                            {qty === 0 ? (
                              <button
                                onClick={() => handleAdd(p)}
                                className="rounded-full px-3 py-1 text-xs font-bold text-white"
                                style={{ backgroundColor: primaryColor }}
                              >
                                + Agregar
                              </button>
                            ) : (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleRemove(p.id)}
                                  className="h-7 w-7 rounded-full bg-gray-100 font-bold text-gray-800"
                                >
                                  −
                                </button>
                                <span className="w-4 text-center text-sm font-bold" style={{ color: primaryColor }}>
                                  {qty}
                                </span>
                                <button
                                  onClick={() => handleAdd(p)}
                                  className="h-7 w-7 rounded-full font-bold text-white"
                                  style={{ backgroundColor: primaryColor }}
                                >
                                  +
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Barra flotante del carrito */}
      {cartCount > 0 && !showCheckout && (
        <div className="fixed bottom-0 left-0 right-0 p-3">
          <button
            onClick={() => setShowCheckout(true)}
            className="mx-auto flex max-w-md w-full items-center justify-between rounded-xl px-4 py-3 shadow-lg text-white font-bold text-sm"
            style={{ backgroundColor: primaryColor }}
          >
            <span>🛒 {cartCount} {cartCount === 1 ? 'producto' : 'productos'}</span>
            <span>Ver Pedido · {formatMoney(cartTotal, cartCurrency)}</span>
          </button>
        </div>
      )}

      {/* Panel: carrito + selección de mesa */}
      {showCheckout && !confirming && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto"
            style={{ backgroundColor: cardColor }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-black" style={{ color: primaryColor }}>
                Mi Pedido
              </h2>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-sm font-bold"
                style={{ color: secondaryColor }}
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 mb-4">
              {cart.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRemove(item.product_id)}
                      className="h-6 w-6 rounded-full bg-gray-100 font-bold text-gray-800 text-xs"
                    >
                      −
                    </button>
                    <span className="font-bold" style={{ color: primaryColor }}>
                      {item.quantity} × {item.name}
                    </span>
                  </div>
                  <span className="font-extrabold" style={{ color: primaryColor }}>
                    {formatMoney(item.unit_price * item.quantity, item.currency)}
                  </span>
                </div>
              ))}
              <div
                className="flex items-center justify-between text-base font-black pt-2 border-t"
                style={{ borderColor: secondaryColor, color: primaryColor }}
              >
                <span>Total</span>
                <span>{formatMoney(cartTotal, cartCurrency)}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold mb-1" style={{ color: primaryColor }}>
                👤 Tu nombre *
              </label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => {
                  setCustomerName(e.target.value);
                  setNameTouched(false);
                }}
                placeholder="¿Cómo te llamas?"
                className={`w-full rounded-lg border px-3 py-2 text-sm font-bold focus:outline-none ${
                  nameTouched && !customerName.trim() ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {nameTouched && !customerName.trim() && (
                <p className="text-xs text-red-600 font-bold mt-1">
                  ⚠️ Escribe tu nombre para que te encontremos al entregar.
                </p>
              )}
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold mb-1" style={{ color: primaryColor }}>
                🪑 ¿En qué mesa estás? *
              </label>
              <select
                value={selectedTableId}
                onChange={(e) => {
                  setSelectedTableId(e.target.value);
                  setTableTouched(false);
                }}
                className={`w-full rounded-lg border px-3 py-2 text-sm font-bold focus:outline-none ${
                  tableTouched && !selectedTableId ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Selecciona tu mesa...</option>
                {tables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              {tableTouched && !selectedTableId && (
                <p className="text-xs text-red-600 font-bold mt-1">
                  ⚠️ Selecciona tu mesa para continuar.
                </p>
              )}
              {tables.length === 0 && (
                <p className="text-xs text-red-600 font-bold mt-1">
                  Este restaurante aún no tiene mesas configuradas. No es posible confirmar el pedido.
                </p>
              )}
            </div>

            <button
              onClick={handleGoToConfirm}
              disabled={tables.length === 0}
              className="w-full rounded-lg py-3 text-sm font-bold text-white disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              Revisar Pedido →
            </button>
          </div>
        </div>
      )}

      {/* Panel: confirmación final "¿Estás seguro?" */}
      {showCheckout && confirming && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
          <div
            className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto"
            style={{ backgroundColor: cardColor }}
          >
            <h2 className="text-lg font-black mb-1" style={{ color: primaryColor }}>
              ¿Confirmas tu pedido?
            </h2>
            <p className="text-xs mb-4" style={{ color: secondaryColor }}>
              {branch.name} · Mesa: <span className="font-bold">{selectedTable?.name}</span> · A nombre de: <span className="font-bold">{customerName}</span>
            </p>

            <div className="space-y-2 mb-4">
              {cart.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between text-sm">
                  <span className="font-bold" style={{ color: primaryColor }}>
                    {item.quantity} × {item.name}
                  </span>
                  <span className="font-extrabold" style={{ color: primaryColor }}>
                    {formatMoney(item.unit_price * item.quantity, item.currency)}
                  </span>
                </div>
              ))}
              <div
                className="flex items-center justify-between text-base font-black pt-2 border-t"
                style={{ borderColor: secondaryColor, color: primaryColor }}
              >
                <span>Total</span>
                <span>{formatMoney(cartTotal, cartCurrency)}</span>
              </div>
            </div>

            {submitError && (
              <p className="text-xs text-red-600 font-bold mb-3">{submitError}</p>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={submitting}
                className="flex-1 rounded-lg border border-gray-300 py-3 text-sm font-bold disabled:opacity-50"
                style={{ color: primaryColor }}
              >
                ← Volver a revisar
              </button>
              <button
                onClick={handleSendOrder}
                disabled={submitting}
                className="flex-1 rounded-lg py-3 text-sm font-bold text-white disabled:opacity-50"
                style={{ backgroundColor: primaryColor }}
              >
                {submitting ? 'Enviando...' : '✓ Enviar Pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}