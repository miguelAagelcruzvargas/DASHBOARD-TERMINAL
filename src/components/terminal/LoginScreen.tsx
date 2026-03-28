import { motion } from 'motion/react';
import { Bus, User as UserIcon, Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';
import { Branding, BTN_PRIMARY, DEFAULT_BRANDING, INPUT_CLASS } from './config';

const stats = [
  { value: '24/7', label: 'Operacion fluida' },
  { value: '+120', label: 'Asientos por jornada' },
  { value: '1 panel', label: 'Venta y control' },
];

const trustPoints = ['Acceso protegido', 'Venta rapida', 'Panel centralizado'];

type Props = {
  onLogin: (credentials: { email: string; password: string }) => Promise<void> | void;
  branding: Branding;
  authError?: string | null;
  credentials: { email: string; password: string };
  setCredentials: (next: { email: string; password: string }) => void;
};

export function LoginScreen({ onLogin, branding, authError, credentials, setCredentials }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const heroImage = branding.heroImages?.[0] || branding.heroImageUrl || DEFAULT_BRANDING.heroImageUrl;
  const submit = () => onLogin(credentials);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_right,#ffe4d4_0%,#fff8f3_36%,#e5f6f0_100%)] text-slate-950">
      <motion.div
        className="pointer-events-none absolute -left-24 top-8 h-72 w-72 rounded-full bg-[#ff9f68]/25 blur-3xl"
        animate={{ x: [0, 18, -10, 0], y: [0, 24, 12, 0], scale: [1, 1.08, 0.98, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#49b6a3]/25 blur-3xl"
        animate={{ x: [0, -16, 8, 0], y: [0, -18, 10, 0], scale: [1, 0.96, 1.06, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.3)_0%,rgba(255,255,255,0)_45%,rgba(255,255,255,0.28)_100%)]" />

      <div className="hidden min-h-screen w-full grid-cols-[1.2fr_1fr] overflow-hidden bg-white/80 backdrop-blur-xl xl:grid">
        <div className="relative flex flex-col justify-between p-12 text-[#f7f7f4]">
          <img
            src={heroImage}
            alt="Fondo de marca"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(6,46,43,0.88)_0%,rgba(4,31,34,0.76)_48%,rgba(2,22,28,0.92)_100%)]" />
          <motion.div
            className="absolute -right-16 top-12 h-64 w-64 rounded-full border border-white/10 bg-white/10 blur-2xl"
            animate={{ y: [0, 22, 0], scale: [1, 1.08, 1] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute bottom-10 left-10 h-28 w-28 rounded-full border border-[#8fd2c6]/30 bg-[#8fd2c6]/10"
            animate={{ y: [0, -18, 0], x: [0, 10, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-y-0 left-1/3 w-24 -skew-x-12 bg-[linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0.12)_50%,rgba(255,255,255,0.03)_100%)] blur-xl"
            animate={{ x: [-120, 240, -120] }}
            transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
          />

          <div className="relative z-10 max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-md"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-[#86efac] shadow-[0_0_20px_rgba(134,239,172,0.85)]" />
              <p className="text-[11px] font-black uppercase tracking-[0.35em] text-[#d7f7ef]">{branding.companyName}</p>
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.08, ease: 'easeOut' }}
              className="mt-6 max-w-2xl text-6xl font-black leading-[0.9] tracking-tight"
            >
              {branding.tagline}
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.16, ease: 'easeOut' }}
              className="mt-6 max-w-xl text-base text-[#b8d8d1]"
            >
              Controla corridas, asientos y ventas en una sola pantalla, optimizada para ventanilla.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85, delay: 0.24, ease: 'easeOut' }}
              className="mt-8 grid max-w-2xl grid-cols-3 gap-4"
            >
              {stats.map((item) => (
                <div key={item.label} className="rounded-3xl border border-white/12 bg-white/8 px-4 py-4 backdrop-blur-md">
                  <p className="text-2xl font-black text-white">{item.value}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[#b8d8d1]">{item.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: 'easeOut' }}
            className="relative z-10 ml-auto w-full max-w-sm rounded-[2rem] border border-white/12 bg-white/10 p-5 backdrop-blur-md"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-[#8fd2c6]">Monitoreo en cabina</p>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-4xl font-black text-white">98.2%</p>
                <p className="mt-1 text-sm text-[#d2ebe6]">Disponibilidad operativa</p>
              </div>
              <div className="rounded-2xl bg-emerald-300/15 px-3 py-2 text-xs font-bold uppercase tracking-[0.15em] text-emerald-100">
                En linea
              </div>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-[linear-gradient(90deg,#6ee7b7_0%,#34d399_50%,#0ea5a4_100%)]"
                initial={{ width: '0%' }}
                animate={{ width: '98%' }}
                transition={{ duration: 1.4, delay: 0.45, ease: 'easeOut' }}
              />
            </div>
          </motion.div>
        </div>

        <div className="relative flex items-center justify-center p-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#ffffff_0%,rgba(255,255,255,0.64)_36%,rgba(233,245,240,0.8)_100%)]" />
          <div className="absolute inset-x-12 top-12 h-px bg-[linear-gradient(90deg,transparent,rgba(15,118,110,0.24),transparent)]" />
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-[2rem] border border-white/70 bg-white/78 p-10 shadow-[0_30px_70px_rgba(15,23,42,0.14)] backdrop-blur-2xl"
          >
            <div className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#0f7666_0%,#34d399_55%,#f59e0b_100%)]" />
            <motion.div
              className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[#14b8a6]/12 blur-3xl"
              animate={{ scale: [1, 1.18, 1], rotate: [0, 20, 0] }}
              transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
            />
            <motion.div
              className="pointer-events-none absolute -bottom-12 left-10 h-24 w-24 rounded-full bg-[#f59e0b]/10 blur-3xl"
              animate={{ x: [0, 16, 0], y: [0, -12, 0] }}
              transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut' }}
            />

            <div className="mb-8 flex items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.35rem] bg-[#0f7666] p-2 text-white shadow-lg shadow-[#0f7666]/30">
                <motion.div
                  className="absolute inset-1 rounded-[1.1rem] border border-white/30"
                  animate={{ scale: [1, 1.08, 1], opacity: [0.45, 0.2, 0.45] }}
                  transition={{ duration: 3.4, repeat: Infinity, ease: 'easeInOut' }}
                />
                {branding.logoUrl ? (
                  <img src={branding.logoUrl} alt="Logo de empresa" className="h-full w-full object-contain" />
                ) : (
                  <Bus className="h-8 w-8" />
                )}
              </div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-[#0f7666]">Acceso</p>
                <h2 className="text-3xl font-black tracking-tight text-[#0f172a]">{branding.companyName}</h2>
                <p className="mt-1 text-sm text-slate-500">Ingresa para abrir el panel operativo.</p>
              </div>
            </div>

            <div className="space-y-4">
              <motion.label initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12, duration: 0.45 }} className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Correo de acceso</span>
                <input
                  type="email"
                  value={credentials.email}
                  onChange={(event) => setCredentials({ ...credentials, email: event.target.value })}
                  className={INPUT_CLASS}
                  placeholder="Correo"
                />
              </motion.label>
              <motion.label initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18, duration: 0.45 }} className="block">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Contrasena</span>
                <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
                  className={INPUT_CLASS}
                  placeholder="Contrasena"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
                </div>
              </motion.label>
            </div>

            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24, duration: 0.45 }}
              whileHover={{ y: -2, scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={submit}
              className={`${BTN_PRIMARY} mt-5 w-full py-4 text-sm`}
            >
              <UserIcon className="h-5 w-5" />
              <span>Iniciar sesion segura</span>
            </motion.button>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.45 }}
              className="mt-5 flex flex-wrap gap-2"
            >
              {trustPoints.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-emerald-100 bg-emerald-50/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700"
                >
                  {item}
                </span>
              ))}
            </motion.div>

            {authError && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                {authError}
              </p>
            )}
          </motion.div>
        </div>
      </div>

      <div className="relative flex min-h-screen w-full flex-col justify-between bg-white/84 p-6 backdrop-blur-xl xl:hidden">
        <motion.div
          className="pointer-events-none absolute right-0 top-16 h-40 w-40 rounded-full bg-[#14b8a6]/15 blur-3xl"
          animate={{ scale: [1, 1.12, 1], y: [0, 14, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative z-10">
          <div className="inline-flex h-16 w-16 items-center justify-center overflow-hidden rounded-[1.35rem] bg-[#0f7666] p-2 text-white shadow-lg shadow-[#0f7666]/30">
            {branding.logoUrl ? (
              <img src={branding.logoUrl} alt="Logo de empresa" className="h-full w-full object-contain" />
            ) : (
              <Bus className="h-8 w-8" />
            )}
          </div>
          <p className="mt-6 text-[11px] font-black uppercase tracking-[0.3em] text-[#0f7666]">{branding.companyName}</p>
          <h2 className="mt-3 text-4xl font-black leading-[0.95] tracking-tight text-[#111827]">{branding.tagline}</h2>
          <p className="mt-4 max-w-sm text-sm text-slate-600">Accede al panel de ventas con una interfaz mas clara, rapida y enfocada en ventanilla.</p>
        </div>

        <div className="relative z-10 rounded-[2rem] border border-white/70 bg-white/70 p-5 shadow-[0_24px_50px_rgba(15,23,42,0.08)] backdrop-blur-xl">
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Correo de acceso</span>
              <input
                type="email"
                value={credentials.email}
                onChange={(event) => setCredentials({ ...credentials, email: event.target.value })}
                className={INPUT_CLASS}
                placeholder="Correo"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">Contrasena</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={credentials.password}
                  onChange={(event) => setCredentials({ ...credentials, password: event.target.value })}
                  className={INPUT_CLASS}
                  placeholder="Contrasena"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </label>
          </div>
          <button onClick={submit} className={`${BTN_PRIMARY} mt-5 w-full py-4`}>
            <UserIcon className="h-5 w-5" />
            <span>Iniciar sesion segura</span>
          </button>
          <div className="mt-4 flex flex-wrap gap-2">
            {trustPoints.map((item) => (
              <span
                key={item}
                className="rounded-full border border-emerald-100 bg-emerald-50/80 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-700"
              >
                {item}
              </span>
            ))}
          </div>
          {authError && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {authError}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
