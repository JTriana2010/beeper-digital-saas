import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6">
      {/* Barra superior */}
      <header className="flex justify-between items-center max-w-5xl w-full mx-auto py-4 border-b border-slate-800">
        <h1 className="text-2xl font-bold text-indigo-400">BeeperKery</h1>
        <Link
          href="/login"
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-medium transition"
        >
          Iniciar Sesión
        </Link>
      </header>

      {/* Presentación Principal */}
      <main className="max-w-3xl w-full mx-auto text-center my-auto py-12">
        <span className="bg-indigo-950 text-indigo-300 text-xs uppercase tracking-widest font-semibold px-3 py-1 rounded-full border border-indigo-800">
          SaaS para Restaurantes y Locales
        </span>

        <h2 className="text-4xl sm:text-5xl font-extrabold tracking-tight mt-6 mb-6 leading-tight">
          Reemplaza los beepers físicos de tu restaurante por códigos QR
        </h2>

        <p className="text-lg text-slate-400 mb-8 leading-relaxed">
          Elimina los localizadores plásticos costosos y difíciles de desinfectar. Tus clientes escanean el código, esperan su comida cómodamente y reciben alertas sonoras con vibración directamente en su celular, aun con la pantalla apagada.
        </p>

        {/* Características breves */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left mb-10">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <h3 className="font-semibold text-white mb-1">Sin descargas</h3>
            <p className="text-xs text-slate-400">El cliente no necesita instalar ninguna app, todo funciona desde el navegador.</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <h3 className="font-semibold text-white mb-1">Alertas en segundo plano</h3>
            <p className="text-xs text-slate-400">La notificación vibra y suena incluso con el celular guardado o bloqueado.</p>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <h3 className="font-semibold text-white mb-1">Ahorro de costos</h3>
            <p className="text-xs text-slate-400">Sin aparatos perdidos, rotos o baterías que reemplazar.</p>
          </div>
        </div>

        <Link
          href="/login"
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-semibold text-lg transition inline-block shadow-lg shadow-indigo-600/30"
        >
          Prueba Gratis (Hasta 100 pedidos/mes)
        </Link>
      </main>

      {/* Pie de página */}
      <footer className="text-center text-slate-500 text-sm py-4 border-t border-slate-900">
        © {new Date().getFullYear()} BeeperKery — Sistema Inteligente de Notificación a Clientes.
      </footer>
    </div>
  );
}