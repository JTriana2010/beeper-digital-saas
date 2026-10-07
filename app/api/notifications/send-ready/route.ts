import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import webpush from 'web-push';

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'Falta orderId' }, { status: 400 });
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:soporte@example.com';

    if (!publicKey || !privateKey) {
      console.error('Faltan las llaves VAPID en las variables de entorno.');
      return NextResponse.json({ error: 'No configurado' }, { status: 500 });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    // Esta ruta no recibe una sesión del cliente (el aviso lo dispara
    // el admin desde el dashboard), así que usamos el cliente con
    // permisos elevados para leer las suscripciones guardadas -- nadie
    // más puede leer esta tabla (ver Paso 015, política RLS).
    const supabaseAdmin = createAdminClient();

    const { data: orderRow } = await supabaseAdmin
      .from('orders')
      .select('public_token')
      .eq('id', orderId)
      .single();

    const { data: subscriptions, error } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('order_id', orderId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      // Es normal: el cliente puede no haber activado las notificaciones.
      return NextResponse.json({ sent: 0 });
    }

    const payload = JSON.stringify({
      title: '🔔 ¡PEDIDO LISTO!',
      body: 'Pasa a recogerlo cuando quieras.',
      url: orderRow?.public_token ? `/order/${orderRow.public_token}` : '/',
    });

    let sent = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
        sent += 1;
      } catch (err) {
        // Una suscripción puede haber expirado (el cliente cerró el
        // navegador hace mucho, etc.) -- no es un error grave, seguimos
        // con las demás.
        console.error('Error enviando push a una suscripción:', err);
      }
    }

    return NextResponse.json({ sent });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error inesperado';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}