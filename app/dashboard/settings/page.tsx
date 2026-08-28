'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SettingsPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [branchName, setBranchName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  // Colores Dashboard Admin
  const [dashBgColor, setDashBgColor] = useState('#f9fafb');
  const [dashCardColor, setDashCardColor] = useState('#ffffff');
  const [dashPrimaryColor, setDashPrimaryColor] = useState('#111827');
  const [dashSecondaryColor, setDashSecondaryColor] = useState('#4b5563');

  // Colores Cliente (Beeper)
  const [clientBgColor, setClientBgColor] = useState('#f9fafb');
  const [clientCardColor, setClientCardColor] = useState('#ffffff');
  const [clientPrimaryColor, setClientPrimaryColor] = useState('#111827');
  const [clientSecondaryColor, setClientSecondaryColor] = useState('#4b5563');

  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    async function loadSettings() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id, branch_id')
        .eq('id', user.id)
        .single();

      if (profile) {
        setCompanyId(profile.company_id);
        setBranchId(profile.branch_id);

        if (profile.company_id) {
          const { data: company } = await supabase
            .from('companies')
            .select('name')
            .eq('id', profile.company_id)
            .single();
          if (company?.name) setCompanyName(company.name);
        }

        if (profile.branch_id) {
          const { data: branch } = await supabase
            .from('branches')
            .select('*')
            .eq('id', profile.branch_id)
            .single();

          if (branch) {
            setBranchName(branch.name || '');
            setLogoUrl(branch.logo_url || '');

            // Admin Dashboard
            if (branch.dash_bg_color) setDashBgColor(branch.dash_bg_color);
            if (branch.dash_card_color) setDashCardColor(branch.dash_card_color);
            if (branch.dash_primary_color) setDashPrimaryColor(branch.dash_primary_color);
            if (branch.dash_secondary_color) setDashSecondaryColor(branch.dash_secondary_color);

            // Cliente
            if (branch.bg_color) setClientBgColor(branch.bg_color);
            if (branch.client_card_color) setClientCardColor(branch.client_card_color);
            if (branch.primary_color) setClientPrimaryColor(branch.primary_color);
            if (branch.secondary_color) setClientSecondaryColor(branch.secondary_color);
          }
        }
      }
      setLoading(false);
    }

    loadSettings();
  }, []);

  const handleResetAdminDefaults = () => {
    setDashBgColor('#f9fafb');
    setDashCardColor('#ffffff');
    setDashPrimaryColor('#111827');
    setDashSecondaryColor('#4b5563');
  };

  const handleCopyAdminToClient = () => {
    setClientBgColor(dashBgColor);
    setClientCardColor(dashCardColor);
    setClientPrimaryColor(dashPrimaryColor);
    setClientSecondaryColor(dashSecondaryColor);
  };

  const handleCopyClientToAdmin = () => {
    setDashBgColor(clientBgColor);
    setDashCardColor(clientCardColor);
    setDashPrimaryColor(clientPrimaryColor);
    setDashSecondaryColor(clientSecondaryColor);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId || !companyId) return;

    setSaving(true);
    setMessage('');

    const { error: companyError } = await supabase
      .from('companies')
      .update({ name: companyName })
      .eq('id', companyId);

    const { error: branchError } = await supabase
      .from('branches')
      .update({
        name: branchName,
        logo_url: logoUrl,
        // Admin
        dash_bg_color: dashBgColor,
        dash_card_color: dashCardColor,
        dash_primary_color: dashPrimaryColor,
        dash_secondary_color: dashSecondaryColor,
        // Client
        bg_color: clientBgColor,
        client_card_color: clientCardColor,
        primary_color: clientPrimaryColor,
        secondary_color: clientSecondaryColor,
      })
      .eq('id', branchId);

    setSaving(false);

    if (companyError || branchError) {
      setMessage('❌ Error al guardar los cambios.');
    } else {
      setMessage('✅ Configuración guardada correctamente.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-black">
        <p className="text-sm font-semibold">Cargando ajustes...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-10 text-black">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/dashboard"
              className="text-xs font-bold text-blue-600 hover:underline mb-1 inline-block"
            >
              ← Volver al Panel
            </Link>
            <h1 className="text-2xl font-black text-black">Ajustes del Negocio</h1>
            <p className="text-xs text-gray-600">Personalización independiente de paneles y marca</p>
          </div>
        </div>

        {message && (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm font-bold text-blue-900">
            {message}
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* Nombre y Logo */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
            <h2 className="text-base font-bold text-black border-b border-gray-100 pb-2">
              Información General
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Nombre del Restaurante / Empresa
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black font-bold bg-white focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black mb-1">
                  Nombre de la Sede
                </label>
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black font-bold bg-white focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-black mb-1">
                URL del Logotipo (Aparecerá en ambos paneles)
              </label>
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://ejemplo.com/logo.png"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-black font-bold bg-white focus:outline-none"
              />
            </div>
          </div>

          {/* Personalización Dashboard Administrador */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-2 gap-2">
              <h2 className="text-base font-bold text-black">
                🎨 Personalización - Dashboard Admin (Restaurante)
              </h2>
              <button
                type="button"
                onClick={handleResetAdminDefaults}
                className="text-xs font-bold text-gray-700 bg-gray-100 border border-gray-300 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                🔄 Restablecer Por Defecto (Admin)
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-xs font-bold text-black mb-2">Fondo General</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={dashBgColor}
                    onChange={(e) => setDashBgColor(e.target.value)}
                    className="h-9 w-10 cursor-pointer rounded border border-gray-300 p-0"
                  />
                  <input
                    type="text"
                    value={dashBgColor}
                    onChange={(e) => setDashBgColor(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-black font-mono font-bold uppercase"
                  />
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-xs font-bold text-black mb-2">Cajas de Información</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={dashCardColor}
                    onChange={(e) => setDashCardColor(e.target.value)}
                    className="h-9 w-10 cursor-pointer rounded border border-gray-300 p-0"
                  />
                  <input
                    type="text"
                    value={dashCardColor}
                    onChange={(e) => setDashCardColor(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-black font-mono font-bold uppercase"
                  />
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-xs font-bold text-black mb-2">Títulos Principales</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={dashPrimaryColor}
                    onChange={(e) => setDashPrimaryColor(e.target.value)}
                    className="h-9 w-10 cursor-pointer rounded border border-gray-300 p-0"
                  />
                  <input
                    type="text"
                    value={dashPrimaryColor}
                    onChange={(e) => setDashPrimaryColor(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-black font-mono font-bold uppercase"
                  />
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-xs font-bold text-black mb-2">Texto Secundario</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={dashSecondaryColor}
                    onChange={(e) => setDashSecondaryColor(e.target.value)}
                    className="h-9 w-10 cursor-pointer rounded border border-gray-300 p-0"
                  />
                  <input
                    type="text"
                    value={dashSecondaryColor}
                    onChange={(e) => setDashSecondaryColor(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-black font-mono font-bold uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Botones de Sincronización de Paleta */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 bg-blue-50 p-4 rounded-xl border border-blue-200">
            <button
              type="button"
              onClick={handleCopyAdminToClient}
              className="w-full sm:w-auto text-xs font-bold text-blue-900 bg-white border border-blue-300 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              ➡️ Copiar Colores de Admin a Cliente
            </button>
            <button
              type="button"
              onClick={handleCopyClientToAdmin}
              className="w-full sm:w-auto text-xs font-bold text-blue-900 bg-white border border-blue-300 hover:bg-blue-100 px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              ⬅️ Copiar Colores de Cliente a Admin
            </button>
          </div>

          {/* Personalización Beeper Cliente */}
          <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-200 space-y-4">
            <h2 className="text-base font-bold text-black border-b border-gray-100 pb-2">
              📱 Personalización - Dashboard Cliente (Beeper Digital)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-xs font-bold text-black mb-2">Fondo General</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={clientBgColor}
                    onChange={(e) => setClientBgColor(e.target.value)}
                    className="h-9 w-10 cursor-pointer rounded border border-gray-300 p-0"
                  />
                  <input
                    type="text"
                    value={clientBgColor}
                    onChange={(e) => setClientBgColor(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-black font-mono font-bold uppercase"
                  />
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-xs font-bold text-black mb-2">Cajas de Información</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={clientCardColor}
                    onChange={(e) => setClientCardColor(e.target.value)}
                    className="h-9 w-10 cursor-pointer rounded border border-gray-300 p-0"
                  />
                  <input
                    type="text"
                    value={clientCardColor}
                    onChange={(e) => setClientCardColor(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-black font-mono font-bold uppercase"
                  />
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-xs font-bold text-black mb-2">Títulos Principales</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={clientPrimaryColor}
                    onChange={(e) => setClientPrimaryColor(e.target.value)}
                    className="h-9 w-10 cursor-pointer rounded border border-gray-300 p-0"
                  />
                  <input
                    type="text"
                    value={clientPrimaryColor}
                    onChange={(e) => setClientPrimaryColor(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-black font-mono font-bold uppercase"
                  />
                </div>
              </div>

              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                <label className="block text-xs font-bold text-black mb-2">Texto Secundario</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={clientSecondaryColor}
                    onChange={(e) => setClientSecondaryColor(e.target.value)}
                    className="h-9 w-10 cursor-pointer rounded border border-gray-300 p-0"
                  />
                  <input
                    type="text"
                    value={clientSecondaryColor}
                    onChange={(e) => setClientSecondaryColor(e.target.value)}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-xs text-black font-mono font-bold uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors shadow-md"
          >
            {saving ? 'Guardando Cambios...' : 'Guardar Toda la Configuración'}
          </button>
        </form>
      </div>
    </div>
  );
}