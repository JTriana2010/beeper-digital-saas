import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// ¡Importante! Este cliente usa la "service role key", que se salta
// TODAS las políticas de RLS. Por eso SOLO debe usarse dentro de rutas
// de servidor (app/api/...) que nunca reciben datos directos del
// navegador del usuario sin validar -- como el webhook de pagos o el
// envío de notificaciones push, que no vienen del navegador de ningún
// cliente.
//
// La variable SUPABASE_SERVICE_ROLE_KEY debe configurarse SOLO en las
// variables de entorno de Vercel (Settings → Environment Variables),
// SIN el prefijo NEXT_PUBLIC_ (eso la expondría al navegador).
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Faltan variables de entorno para el cliente admin de Supabase (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).'
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}