'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';

interface OrderData {
  id: string;
  order_number: string;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  total_amount?: number;
  currency?: string;
  branches: {
    name: string;
    logo_url: string;
    bg_color: string;
    client_card_color: string;
    primary_color: string;
    secondary_color: string;
    companies: {
      name: string;
    };
  };
}

export default function ClientOrderPage() {
  const params = useParams();
  const token = params?.token as string;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // Tono de alerta en bucle
    audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audioRef.current.loop = true;

    async function fetchOrder() {
      if (!token) return;

      // 1) Traemos el pedido mediante la función segura (ya no hay
      //    lectura pública directa sobre la tabla `orders`).
      const { data: orderRows, error: orderError } = await supabase
        .rpc('get_order_by_token', { p_token: token });

      const orderRow = orderRows?.[0];

      if (orderError || !orderRow) {
        setLoading(false);
        return;
      }

      // 2) La sede sí es de lectura pública, la traemos aparte junto
      //    con el nombre de la empresa dueña de esa sede.
      const { data: branchRow } = await supabase
        .from('branches')
        .select(`
          name,
          logo_url,
          bg_color,
          client_card_color,
          primary_color,
          secondary_color,
          companies (
            name
          )
        `)
        .eq('id', orderRow.branch_id)
        .single();

      const combined = {
        ...orderRow,
        branches: branchRow,
      } as unknown as OrderData;

      setOrder(combined);
      if (orderRow.status === 'READY') {
        playAudio();
      }
      setLoading(false);
    }

    fetchOrder();

    // Suscripción en tiempo real: canal privado, único para este pedido
    const channel = supabase
      .channel(`pedido-estado-${token}`, { config: { private: true } })
      .on(
        'broadcast',
        { event: 'UPDATE' },
        async (payload) => {
          const updatedOrder = payload.payload.record as { status: OrderData['status'] };
          setOrder((prev) => (prev ? { ...prev, status: updatedOrder.status } : null));

          if (updatedOrder.status === 'READY') {
            playAudio();
          } else {
            stopAudio();
          }
        }
      )
      .subscribe();

    return () => {
      stopAudio();
      supabase.removeChannel(channel);
    };
  }, [token]);

  // Habilitar el audio del navegador mediante interacción explícita del usuario
  const handleEnableAudio = () => {
    setAudioEnabled(true);
    if (order?.status === 'READY') {
      playAudio();
    } else {
      // Reproduce un breve tono de prueba y lo pausa para desbloquear la reproducción automática
      if (audioRef.current) {
        audioRef.current.play().then(() => {
          setTimeout(() => {
            if (order?.status !== 'READY') {
              audioRef.current?.pause();
              audioRef.current!.currentTime = 0;
            }
          }, 300);
        }).catch((err) => console.log('Error reproduciendo sonido:', err));
      }
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        setIsPlayingAudio(true);
        setAudioEnabled(true);
      }).catch((err) => {
        console.log('Autoplay prevenido por el navegador:', err);
      });
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlayingAudio(false);
  };

  const formatMoney = (amount: number = 0, curr: string = 'COP') => {
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
        <p className="text-sm font-semibold">Cargando Beeper Digital...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 text-black p-6">
        <div className="text-center max-w-sm rounded-xl bg-white p-6 shadow-md border border-gray-200">
          <h1 className="text-lg font-bold text-red-600">Pedido No Encontrado</h1>
          <p className="text-xs text-gray-500 mt-1">El código del beeper no es válido o expiró.</p>
        </div>
      </div>
    );
  }

  const branch = order.branches;
  const companyName = branch?.companies?.name || '';
  const branchName = branch?.name || 'Sede Principal';
  const logoUrl = branch?.logo_url;

  const bgColor = branch?.bg_color || '#f9fafb';
  const cardColor = branch?.client_card_color || '#ffffff';
  const primaryColor = branch?.primary_color || '#111827';
  const secondaryColor = branch?.secondary_color || '#4b5563';

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 text-center transition-colors duration-300"
      style={{ backgroundColor: bgColor }}
    >
      <div className="w-full max-w-md space-y-6">
        {/* Cabecera Restaurante y Logo Grande */}
        <div className="space-y-3">
          {logoUrl && (
            <div className="flex justify-center">
              <img
                src={logoUrl}
                alt="Logo del negocio"
                className="h-28 w-28 object-contain rounded-2xl border-2 border-white/50 bg-white p-2 shadow-lg"
              />
            </div>
          )}

          <div>
            {companyName && (
              <p className="text-sm font-black uppercase tracking-wider text-blue-600">
                {companyName}
              </p>
            )}
            <h1 className="text-2xl font-black" style={{ color: primaryColor }}>
              {branchName}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: secondaryColor }}>
              Beeper Digital de Pedidos
            </p>
          </div>
        </div>

        {/* Tarjeta de Estado del Pedido */}
        <div
          className="rounded-2xl p-8 shadow-xl border border-gray-200/80 space-y-6"
          style={{ backgroundColor: cardColor }}
        >
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Número de Turno / Pedido
            </span>
            <div className="text-5xl font-black mt-1" style={{ color: primaryColor }}>
              #{order.order_number}
            </div>

            {order.total_amount !== undefined && order.total_amount !== null && (
              <div className="mt-2 inline-block rounded-full bg-gray-100 border border-gray-200 px-3 py-1 text-xs font-extrabold text-gray-800">
                Total: {formatMoney(order.total_amount, order.currency || 'COP')}
              </div>
            )}
          </div>

          {/* Botones de Control de Sonido Grande */}
          <div className="pt-2 border-t border-b border-gray-100 py-4">
            {!audioEnabled && (
              <button
                onClick={handleEnableAudio}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-4 px-6 rounded-xl text-sm shadow-lg transition-all animate-pulse flex items-center justify-center gap-3 border-2 border-blue-400"
              >
                <span className="text-2xl">🔊</span>
                <div className="text-left">
                  <p className="font-extrabold text-sm uppercase">TOCA AQUÍ PARA ACTIVAR EL SONIDO</p>
                  <p className="text-[11px] font-normal opacity-90">Necesario para sonar cuando tu pedido esté listo</p>
                </div>
              </button>
            )}

            {audioEnabled && !isPlayingAudio && (
              <button
                onClick={handleEnableAudio}
                className="w-full bg-green-50 border border-green-300 text-green-900 font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 hover:bg-green-100 transition-colors"
              >
                <span>🔊</span> Sonido Activado (Toca para probar la alerta)
              </button>
            )}

            {isPlayingAudio && (
              <button
                onClick={stopAudio}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-black py-4 px-6 rounded-xl text-base shadow-xl transition-all animate-bounce flex items-center justify-center gap-2 border-2 border-red-400"
              >
                <span className="text-2xl">🔇</span> APAGAR ALARMA / SILENCIAR
              </button>
            )}
          </div>

          {/* Indicador de Estado */}
          <div>
            {order.status === 'PREPARING' && (
              <div className="rounded-xl bg-yellow-100 border border-yellow-300 p-4 text-yellow-900 animate-pulse">
                <p className="text-lg font-black">👨‍🍳 EN PREPARACIÓN</p>
                <p className="text-xs font-bold mt-1 text-yellow-800">
                  Estamos preparando tu pedido. Te avisaremos cuando esté listo.
                </p>
              </div>
            )}

            {order.status === 'READY' && (
              <div className="rounded-xl bg-green-500 border-2 border-green-600 p-5 text-white shadow-lg animate-bounce space-y-2">
                <p className="text-2xl font-black">🔔 ¡TU PEDIDO ESTÁ LISTO!</p>
                <p className="text-xs font-bold">
                  Por favor acércate al mostrador para retirar tu pedido.
                </p>
              </div>
            )}

            {order.status === 'DELIVERED' && (
              <div className="rounded-xl bg-gray-100 border border-gray-300 p-4 text-gray-800">
                <p className="text-base font-black">✓ PEDIDO ENTREGADO</p>
                <p className="text-xs font-bold text-gray-600 mt-0.5">
                  ¡Gracias por tu compra! Esperamos que lo disfrutes.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}