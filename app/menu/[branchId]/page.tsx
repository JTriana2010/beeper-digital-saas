'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
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

export default function PublicMenuPage() {
  const params = useParams();
  const branchId = params.branchId as string;

  const [branch, setBranch] = useState<BranchInfo | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

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

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: bgColor }}>
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
                  {catProducts.map((p) => (
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
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}