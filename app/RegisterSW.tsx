'use client';

import { useEffect } from 'react';

export default function RegisterSW() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => console.log('Service Worker registrado con éxito:', reg.scope))
        .catch((err) => console.error('Error al registrar Service Worker:', err));
    }
  }, []);

  return null;
}