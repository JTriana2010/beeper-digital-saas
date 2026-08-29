import Link from 'next/link';

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-6 relative">
      {/* Botón para regresar a la landing */}
      <Link
        href="/"
        className="absolute top-6 left-6 text-sm text-slate-400 hover:text-white transition flex items-center gap-2"
      >
        ← Volver al inicio
      </Link>

      {/* Tarjeta de Login */}
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-indigo-400 tracking-tight">
            BeeperKery
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Acceso para Personal de Restaurante
          </p>
        </div>

        <form className="space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Correo Electrónico
            </label>
            <input
              type="email"
              placeholder="cajero@restaurante.com"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Contraseña
            </label>
            <input
              type="password"
              placeholder="••••••••"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition"
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3.5 rounded-xl transition shadow-lg shadow-indigo-600/25 mt-2"
          >
            Iniciar Sesión
          </button>
        </form>
      </div>
    </div>
  );
}