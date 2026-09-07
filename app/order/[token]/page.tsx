'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useParams } from 'next/navigation';

// Cada sonido es una lista de notas (frecuencia + duración) generadas
// directamente por el navegador -- no dependen de ningún link externo
// que se pueda caer o estar mal escrito.
const ALARM_SOUNDS = [
  { id: 'campana', label: '🔔 Campana', wave: 'square' as OscillatorType, notes: [
    { freq: 1046, duration: 0.15 },
    { freq: 784, duration: 0.35 },
  ] },
  { id: 'timbre', label: '📯 Timbre', wave: 'square' as OscillatorType, notes: [
    { freq: 880, duration: 0.12 },
    { freq: 880, duration: 0.12 },
  ] },
  { id: 'alerta', label: '🚨 Alerta', wave: 'sawtooth' as OscillatorType, notes: [
    { freq: 1200, duration: 0.15 },
    { freq: 900, duration: 0.15 },
    { freq: 1200, duration: 0.15 },
    { freq: 900, duration: 0.15 },
  ] },
  { id: 'suave', label: '🎵 Suave', wave: 'sine' as OscillatorType, notes: [
    { freq: 660, duration: 0.6 },
  ] },
];

interface OrderItem {
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface OrderData {
  id: string;
  order_number: string;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'DELIVERED' | 'CANCELLED';
  total_amount?: number;
  currency?: string;
  items?: OrderItem[];
  table_name?: string | null;
  customer_name?: string | null;
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
  const [selectedSoundId, setSelectedSoundId] = useState(ALARM_SOUNDS[0].id);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const loopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  useEffect(() => {
    // Recuerda el sonido que el cliente eligió la última vez en este celular
    const savedSoundId = typeof window !== 'undefined' ? localStorage.getItem('alarma_sonido_id') : null;
    const initialSound = ALARM_SOUNDS.find((s) => s.id === savedSoundId) || ALARM_SOUNDS[0];
    setSelectedSoundId(initialSound.id);

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

  // Crea (o reutiliza) el AudioContext del navegador. Debe crearse o
  // reactivarse dentro de un toque del usuario, por las políticas de
  // autoplay de los celulares.
  const getAudioContext = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContextClass();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  };

  // Reproduce UNA vez el patrón de notas del sonido elegido, generado
  // directamente por el navegador (no depende de ningún archivo externo).
  // Devuelve cuántos segundos dura, para saber cuándo repetirlo.
  const playTonePattern = (soundId: string): number => {
    const ctx = getAudioContext();
    if (!ctx) return 0.5;

    const sound = ALARM_SOUNDS.find((s) => s.id === soundId) || ALARM_SOUNDS[0];
    let t = ctx.currentTime;

    sound.notes.forEach((note) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = sound.wave;
      osc.frequency.value = note.freq;

      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + note.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + note.duration + 0.02);

      t += note.duration + 0.05;
    });

    return t - ctx.currentTime;
  };

  // Habilitar el audio del navegador mediante interacción explícita del usuario
  const handleEnableAudio = () => {
    setAudioEnabled(true);
    getAudioContext();

    // Aprovechamos este mismo toque del usuario para pedir permiso de
    // notificaciones del sistema -- son un segundo canal de aviso que
    // sí interrumpe aunque el celular esté reproduciendo música o video,
    // a diferencia del sonido web normal.
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    if (order?.status === 'READY') {
      playAudio();
    } else {
      // Reproduce el sonido elegido una sola vez, para que el cliente
      // escuche cómo suena y quede desbloqueada la reproducción.
      playTonePattern(selectedSoundId);
    }
  };

  const playAudio = () => {
    setIsPlayingAudio(true);
    setAudioEnabled(true);

    // Canal 1: sonido generado por el navegador, en bucle.
    const cycle = () => {
      const duration = playTonePattern(selectedSoundId);
      loopTimeoutRef.current = setTimeout(cycle, Math.max(duration, 0.3) * 1000 + 500);
    };
    cycle();

    // Canal 2: vibración -- funciona incluso si el sonido está silenciado
    // o hay otro audio sonando por encima (cuando el navegador lo permite;
    // algunos celulares la bloquean si la pestaña no está al frente).
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([400, 200, 400, 200, 400, 200, 400]);
    }

    // Canal 3: notificación del sistema -- en Android normalmente suena
    // y vibra por su propio canal, distinto al de la pestaña del navegador.
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification('¡Tu pedido está listo! 🔔', {
          body: 'Pasa a recogerlo cuando quieras.',
          tag: 'pedido-listo',
        });
      } catch {
        // Si el navegador no soporta notificaciones en este contexto,
        // seguimos igual con audio + vibración.
      }
    }
  };

  const stopAudio = () => {
    if (loopTimeoutRef.current) {
      clearTimeout(loopTimeoutRef.current);
      loopTimeoutRef.current = null;
    }
    setIsPlayingAudio(false);
  };

  const handleChangeSound = (soundId: string) => {
    setSelectedSoundId(soundId);
    localStorage.setItem('alarma_sonido_id', soundId);

    if (isPlayingAudio) {
      // Si está sonando, reinicia el bucle con el nuevo sonido.
      stopAudio();
      setIsPlayingAudio(true);
      const cycle = () => {
        const duration = playTonePattern(soundId);
        loopTimeoutRef.current = setTimeout(cycle, Math.max(duration, 0.3) * 1000 + 500);
      };
      cycle();
    } else {
      // Si no está sonando, solo reproduce un adelanto para que lo escuches.
      playTonePattern(soundId);
    }
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

            {(order.table_name || order.customer_name) && (
              <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
                {order.table_name && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-900">
                    🪑 {order.table_name}
                  </span>
                )}
                {order.customer_name && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 border border-purple-200 px-3 py-1 text-xs font-bold text-purple-900">
                    👤 {order.customer_name}
                  </span>
                )}
              </div>
            )}

            {order.items && order.items.length > 0 && (
              <div className="mt-4 rounded-lg border border-gray-200 divide-y divide-gray-100 text-left">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="font-bold text-gray-800">
                      {item.quantity} × {item.product_name}
                    </span>
                    <span className="font-extrabold text-gray-700">
                      {formatMoney(item.subtotal, order.currency || 'COP')}
                    </span>
                  </div>
                ))}
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

            {audioEnabled && !isPlayingAudio && (
              <div className="mt-3">
                <p className="text-[11px] font-bold text-gray-500 mb-1.5 text-center">
                  Elige el sonido de tu alarma
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {ALARM_SOUNDS.map((sound) => (
                    <button
                      key={sound.id}
                      onClick={() => handleChangeSound(sound.id)}
                      className={`rounded-lg py-2 text-xs font-bold border ${
                        selectedSoundId === sound.id
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {sound.label}
                    </button>
                  ))}
                </div>
              </div>
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