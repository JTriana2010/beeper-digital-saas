'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Category {
  id: string;
  branch_id: string;
  name: string;
  sort_order: number;
}

interface Product {
  id: string;
  branch_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
}

export default function MenuPage() {
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branding, setBranding] = useState({
    bgColor: '#f9fafb',
    cardColor: '#ffffff',
    primaryColor: '#111827',
    secondaryColor: '#4b5563',
  });
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const [productFormOpenFor, setProductFormOpenFor] = useState<string | null>(null);
  const [productForm, setProductForm] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'COP',
    image_url: '',
  });
  const [savingProduct, setSavingProduct] = useState(false);

  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editingProductForm, setEditingProductForm] = useState({
    name: '',
    description: '',
    price: '',
    currency: 'COP',
    image_url: '',
  });

  const supabase = createClient();
  const router = useRouter();

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

        await fetchCategories(profile.branch_id);
        await fetchProducts(profile.branch_id);
      }
      setLoading(false);
    }
    load();
  }, []);

  const fetchCategories = async (bId: string) => {
    const { data } = await supabase
      .from('categories')
      .select('*')
      .eq('branch_id', bId)
      .order('sort_order', { ascending: true });
    if (data) setCategories(data);
  };

  const fetchProducts = async (bId: string) => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('branch_id', bId)
      .order('sort_order', { ascending: true });
    if (data) setProducts(data);
  };

  // ---------- Categorías ----------

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !newCategoryName.trim()) return;

    setSavingCategory(true);
    const { error } = await supabase.from('categories').insert([
      {
        branch_id: branchId,
        name: newCategoryName.trim(),
        sort_order: categories.length,
      },
    ]);

    if (!error) {
      setNewCategoryName('');
      await fetchCategories(branchId);
    } else {
      alert('Error al crear la categoría: ' + error.message);
    }
    setSavingCategory(false);
  };

  const startEditCategory = (cat: Category) => {
    setEditingCategoryId(cat.id);
    setEditingCategoryName(cat.name);
  };

  const handleSaveCategoryEdit = async (categoryId: string) => {
    if (!branchId || !editingCategoryName.trim()) return;
    const { error } = await supabase
      .from('categories')
      .update({ name: editingCategoryName.trim() })
      .eq('id', categoryId);

    if (!error) {
      setEditingCategoryId(null);
      await fetchCategories(branchId);
    } else {
      alert('Error al guardar: ' + error.message);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!branchId) return;
    const productsInCategory = products.filter((p) => p.category_id === categoryId);
    const confirmMsg =
      productsInCategory.length > 0
        ? `Esta categoría tiene ${productsInCategory.length} producto(s). Al borrarla, se borrarán también sus productos. ¿Continuar?`
        : '¿Borrar esta categoría?';
    if (!window.confirm(confirmMsg)) return;

    const { error } = await supabase.from('categories').delete().eq('id', categoryId);
    if (!error) {
      await fetchCategories(branchId);
      await fetchProducts(branchId);
    } else {
      alert('Error al borrar: ' + error.message);
    }
  };

  // ---------- Productos ----------

  const openProductForm = (categoryId: string) => {
    setProductFormOpenFor(categoryId);
    setProductForm({ name: '', description: '', price: '', currency: 'COP', image_url: '' });
  };

  const handleCreateProduct = async (e: React.FormEvent, categoryId: string) => {
    e.preventDefault();
    if (!branchId || !productForm.name.trim()) return;

    setSavingProduct(true);
    const productsInCategory = products.filter((p) => p.category_id === categoryId);

    const { error } = await supabase.from('products').insert([
      {
        branch_id: branchId,
        category_id: categoryId,
        name: productForm.name.trim(),
        description: productForm.description.trim() || null,
        price: parseFloat(productForm.price) || 0,
        currency: productForm.currency,
        image_url: productForm.image_url.trim() || null,
        sort_order: productsInCategory.length,
      },
    ]);

    if (!error) {
      setProductFormOpenFor(null);
      await fetchProducts(branchId);
    } else {
      alert('Error al crear el producto: ' + error.message);
    }
    setSavingProduct(false);
  };

  const handleToggleAvailability = async (product: Product) => {
    if (!branchId) return;
    const { error } = await supabase
      .from('products')
      .update({ is_available: !product.is_available, updated_at: new Date().toISOString() })
      .eq('id', product.id);
    if (!error) await fetchProducts(branchId);
  };

  const startEditProduct = (product: Product) => {
    setEditingProductId(product.id);
    setEditingProductForm({
      name: product.name,
      description: product.description || '',
      price: String(product.price),
      currency: product.currency,
      image_url: product.image_url || '',
    });
  };

  const handleSaveProductEdit = async (productId: string) => {
    if (!branchId || !editingProductForm.name.trim()) return;
    const { error } = await supabase
      .from('products')
      .update({
        name: editingProductForm.name.trim(),
        description: editingProductForm.description.trim() || null,
        price: parseFloat(editingProductForm.price) || 0,
        currency: editingProductForm.currency,
        image_url: editingProductForm.image_url.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', productId);

    if (!error) {
      setEditingProductId(null);
      await fetchProducts(branchId);
    } else {
      alert('Error al guardar: ' + error.message);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!branchId) return;
    if (!window.confirm('¿Borrar este producto?')) return;
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (!error) await fetchProducts(branchId);
    else alert('Error al borrar: ' + error.message);
  };

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
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-black">
        <p className="text-sm font-semibold">Cargando carta...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10 text-black" style={{ backgroundColor: branding.bgColor }}>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <Link href="/dashboard" className="text-xs font-bold text-blue-600 hover:underline mb-1 inline-block">
            ← Volver al Panel
          </Link>
          <h1 className="text-2xl font-black" style={{ color: branding.primaryColor }}>🍽️ Carta / Menú</h1>
          <p className="text-xs" style={{ color: branding.secondaryColor }}>Administra categorías y productos de tu sede</p>
        </div>

        {/* Nueva categoría */}
        <div className="rounded-xl p-6 shadow-sm border border-gray-200" style={{ backgroundColor: branding.cardColor }}>
          <h2 className="text-base font-bold mb-3" style={{ color: branding.primaryColor }}>Nueva Categoría</h2>
          <form onSubmit={handleCreateCategory} className="flex gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="Ej. Hamburguesas"
              required
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold focus:border-blue-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={savingCategory}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {savingCategory ? 'Creando...' : '+ Crear'}
            </button>
          </form>
        </div>

        {/* Categorías y productos */}
        {categories.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">
            Aún no has creado ninguna categoría. Empieza arriba 👆
          </p>
        ) : (
          categories.map((cat) => {
            const catProducts = products.filter((p) => p.category_id === cat.id);
            return (
              <div key={cat.id} className="rounded-xl p-6 shadow-sm border border-gray-200" style={{ backgroundColor: branding.cardColor }}>
                {/* Encabezado de categoría */}
                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
                  {editingCategoryId === cat.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="text"
                        value={editingCategoryName}
                        onChange={(e) => setEditingCategoryName(e.target.value)}
                        className="rounded-lg border border-gray-300 px-2 py-1 text-sm font-bold"
                      />
                      <button
                        onClick={() => handleSaveCategoryEdit(cat.id)}
                        className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded"
                      >
                        Guardar
                      </button>
                      <button
                        onClick={() => setEditingCategoryId(null)}
                        className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded"
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <h2 className="text-lg font-black" style={{ color: branding.primaryColor }}>{cat.name}</h2>
                  )}

                  {editingCategoryId !== cat.id && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => startEditCategory(cat)}
                        className="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="text-xs font-bold text-red-700 bg-red-50 px-2 py-1 rounded hover:bg-red-100"
                      >
                        🗑️ Borrar
                      </button>
                    </div>
                  )}
                </div>

                {/* Productos de esta categoría */}
                <div className="space-y-2">
                  {catProducts.length === 0 && (
                    <p className="text-xs text-gray-400">Sin productos todavía.</p>
                  )}

                  {catProducts.map((p) => (
                    <div
                      key={p.id}
                      className={`rounded-lg border p-3 ${
                        p.is_available ? 'border-gray-200 bg-gray-50/60' : 'border-gray-200 bg-gray-100 opacity-60'
                      }`}
                    >
                      {editingProductId === p.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={editingProductForm.name}
                            onChange={(e) =>
                              setEditingProductForm({ ...editingProductForm, name: e.target.value })
                            }
                            placeholder="Nombre"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-sm font-bold"
                          />
                          <input
                            type="text"
                            value={editingProductForm.description}
                            onChange={(e) =>
                              setEditingProductForm({ ...editingProductForm, description: e.target.value })
                            }
                            placeholder="Descripción"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <input
                              type="number"
                              value={editingProductForm.price}
                              onChange={(e) =>
                                setEditingProductForm({ ...editingProductForm, price: e.target.value })
                              }
                              placeholder="Precio"
                              className="rounded border border-gray-300 px-2 py-1 text-sm font-bold col-span-2"
                            />
                            <select
                              value={editingProductForm.currency}
                              onChange={(e) =>
                                setEditingProductForm({ ...editingProductForm, currency: e.target.value })
                              }
                              className="rounded border border-gray-300 px-1 py-1 text-xs font-bold"
                            >
                              <option value="COP">COP</option>
                              <option value="USD">USD</option>
                              <option value="EUR">EUR</option>
                            </select>
                          </div>
                          <input
                            type="text"
                            value={editingProductForm.image_url}
                            onChange={(e) =>
                              setEditingProductForm({ ...editingProductForm, image_url: e.target.value })
                            }
                            placeholder="URL de imagen (opcional)"
                            className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSaveProductEdit(p.id)}
                              className="text-xs font-bold text-green-700 bg-green-100 px-2 py-1 rounded"
                            >
                              Guardar
                            </button>
                            <button
                              onClick={() => setEditingProductId(null)}
                              className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {p.image_url && (
                              <img
                                src={p.image_url}
                                alt={p.name}
                                className="h-10 w-10 rounded object-cover border border-gray-200 flex-shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-bold truncate">{p.name}</p>
                              {p.description && (
                                <p className="text-xs text-gray-500 truncate">{p.description}</p>
                              )}
                              <p className="text-xs font-extrabold text-gray-800">
                                {formatMoney(p.price, p.currency)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleToggleAvailability(p)}
                              className={`text-[10px] font-bold px-2 py-1 rounded ${
                                p.is_available
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-300 text-gray-700'
                              }`}
                            >
                              {p.is_available ? 'Disponible' : 'Agotado'}
                            </button>
                            <button
                              onClick={() => startEditProduct(p)}
                              className="text-[10px] font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded hover:bg-gray-200"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(p.id)}
                              className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-1 rounded hover:bg-red-100"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Formulario de nuevo producto */}
                {productFormOpenFor === cat.id ? (
                  <form
                    onSubmit={(e) => handleCreateProduct(e, cat.id)}
                    className="mt-3 space-y-2 border-t border-gray-100 pt-3"
                  >
                    <input
                      type="text"
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      placeholder="Nombre del producto"
                      required
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold"
                    />
                    <input
                      type="text"
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      placeholder="Descripción (opcional)"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        placeholder="Precio"
                        required
                        className="col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold"
                      />
                      <select
                        value={productForm.currency}
                        onChange={(e) => setProductForm({ ...productForm, currency: e.target.value })}
                        className="rounded-lg border border-gray-300 px-2 py-2 text-xs font-bold"
                      >
                        <option value="COP">COP</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      value={productForm.image_url}
                      onChange={(e) => setProductForm({ ...productForm, image_url: e.target.value })}
                      placeholder="URL de imagen (opcional)"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={savingProduct}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-50"
                      >
                        {savingProduct ? 'Guardando...' : 'Guardar Producto'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setProductFormOpenFor(null)}
                        className="rounded-lg bg-gray-100 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-200"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => openProductForm(cat.id)}
                    className="mt-3 w-full rounded-lg border border-dashed border-gray-300 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50"
                  >
                    + Agregar producto a {cat.name}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}