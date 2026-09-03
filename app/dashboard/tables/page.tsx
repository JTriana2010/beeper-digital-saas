'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface TableRow {
  id: string;
  branch_id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
}

export default function TablesPage() {
  const [branchId, setBranchId] = useState<string | null>(null);
  const [tables, setTables] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [newTableName, setNewTableName] = useState('');
  const [saving, setSaving] = useState(false);

  const [branding, setBranding] = useState({
    bgColor: '#f9fafb',
    cardColor: '#ffffff',
    primaryColor: '#111827',
    secondaryColor: '#4b5563',
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

        await fetchTables(profile.branch_id);
      }
      setLoading(false);
    }
    load();
  }, []);

  const fetchTables = async (bId: string) => {
    const { data } = await supabase
      .from('tables')
      .select('*')
      .eq('branch_id', bId)
      .order('sort_order', { ascending: true });
    if (data) setTables(data);
  };

  const handleCreateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !newTableName.trim()) return;

    setSaving(true);
    const { error } = await supabase.from('tables').insert([
      {
        branch_id: branchId,
        name: newTableName.trim(),
        sort_order: tables.length,
      },
    ]);

    if (!error) {
      setNewTableName('');
      await fetchTables(branchId);
    } else {
      alert('Error al crear la mesa: ' + error.message);
    }
    setSaving(false);
  };

  const handleToggleActive = async (table: TableRow) => {
    if (!branchId) return;
    const { error } = await supabase
      .from('tables')
      .update({ is_active: !table.is_active })
      .eq('id', table.id);
    if (!error) await fetchTables(branchId);
  };

  const handleDeleteTable = async (tableId: string) => {
    if (!branchId) return;
    if (!window.confirm('¿Borrar esta mesa?')) return;
    const { error } = await supabase.from('tables').delete().eq('id', tableId);
    if (!error) await fetchTables(branchId);
    else alert('Error al borrar: ' + error.message);
  };

  const handleCreateMultiple = async () => {
    if (!branchId) return;
    const input = window.prompt(
      '¿Hasta qué número de mesa quieres crear? (Ej. escribe 10 para crear Mesa 1 a Mesa 10)'
    );
    const count = parseInt(input || '0');
    if (!count || count <= 0) return;

    setSaving(true);
    const startNumber = tables.length + 1;
    const newTables = Array.from({ length: count }, (_, i) => ({
      branch_id: branchId,
      name: `Mesa ${startNumber + i}`,
      sort_order: tables.length + i,
    }));

    const { error } = await supabase.from('tables').insert(newTables);
    if (!error) {
      await fetchTables(branchId);
    } else {
      alert('Error al crear las mesas: ' + error.message);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-black">
        <p className="text-sm font-semibold">Cargando mesas...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 md:p-10" style={{ backgroundColor: branding.bgColor }}>
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link href="/dashboard" className="text-xs font-bold text-blue-600 hover:underline mb-1 inline-block">
            ← Volver al Panel
          </Link>
          <h1 className="text-2xl font-black" style={{ color: branding.primaryColor }}>🪑 Mesas</h1>
          <p className="text-xs" style={{ color: branding.secondaryColor }}>
            Administra las mesas disponibles para que el cliente elija la suya al pedir
          </p>
        </div>

        <div className="rounded-xl p-6 shadow-sm border border-gray-200" style={{ backgroundColor: branding.cardColor }}>
          <h2 className="text-base font-bold mb-3" style={{ color: branding.primaryColor }}>Agregar Mesa</h2>
          <form onSubmit={handleCreateTable} className="flex flex-col sm:flex-row gap-2 mb-2">
            <input
              type="text"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              placeholder="Ej. Mesa 1 o Terraza 3"
              required
              className="w-full sm:flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold focus:border-blue-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto flex-shrink-0 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              + Crear
            </button>
          </form>
          <button
            type="button"
            onClick={handleCreateMultiple}
            disabled={saving}
            className="text-xs font-bold text-blue-600 hover:underline disabled:opacity-50"
          >
            ⚡ Crear varias mesas numeradas de una vez
          </button>
        </div>

        <div className="rounded-xl p-6 shadow-sm border border-gray-200" style={{ backgroundColor: branding.cardColor }}>
          <h2 className="text-base font-bold mb-4" style={{ color: branding.primaryColor }}>
            Tus Mesas ({tables.length})
          </h2>

          {tables.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              Aún no has creado ninguna mesa.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {tables.map((t) => (
                <div
                  key={t.id}
                  className={`rounded-lg border p-3 flex flex-col gap-1.5 ${
                    t.is_active ? 'border-gray-200 bg-gray-50/60' : 'border-gray-200 bg-gray-100 opacity-60'
                  }`}
                >
                  <p className="text-sm font-bold truncate text-gray-900">{t.name}</p>
                  <div className="flex items-center justify-between gap-1">
                    <button
                      onClick={() => handleToggleActive(t)}
                      className={`text-[10px] font-bold px-2 py-1 rounded ${
                        t.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-300 text-gray-700'
                      }`}
                    >
                      {t.is_active ? 'Activa' : 'Inactiva'}
                    </button>
                    <button
                      onClick={() => handleDeleteTable(t.id)}
                      className="text-[10px] font-bold text-red-700 bg-red-50 px-2 py-1 rounded hover:bg-red-100"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}