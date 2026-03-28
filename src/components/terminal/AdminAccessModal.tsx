import { motion } from 'motion/react';
import { Shield, X } from 'lucide-react';
import { BTN_PRIMARY, INPUT_CLASS } from './config';

type Props = {
  open: boolean;
  adminPassword: string;
  adminError: string;
  setAdminPassword: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

export function AdminAccessModal({ open, adminPassword, adminError, setAdminPassword, onClose, onSubmit }: Props) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/55" />
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="relative w-full max-w-sm rounded-2xl border border-black/10 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black tracking-tight">Acceso administrador</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-[#f1f5f9]"><X className="h-4 w-4" /></button>
        </div>
        <p className="mb-3 text-sm text-[#64748b]">Ingresa la clave para abrir el modo admin.</p>
        <input type="password" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSubmit(); }} className={INPUT_CLASS} placeholder="Clave de administrador" autoFocus />
        {adminError && <p className="mt-2 text-xs font-black text-[#b91c1c]">{adminError}</p>}
        <button onClick={onSubmit} className={`${BTN_PRIMARY} mt-4 w-full py-3`}><Shield className="h-4 w-4" /><span>Entrar a admin</span></button>
      </motion.div>
    </div>
  );
}
