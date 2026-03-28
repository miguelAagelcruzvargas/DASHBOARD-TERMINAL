import { motion } from 'motion/react';
import { Ticket } from '../../types';

type Props = {
  open: boolean;
  ticketToCancel: Ticket | null;
  isProcessing: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function CancelTicketModal({ open, ticketToCancel, isProcessing, onClose, onConfirm }: Props) {
  if (!open || !ticketToCancel) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/60" />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="relative w-full max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-2xl">
        <h3 className="text-lg font-black tracking-tight text-[#b91c1c]">Cancelar boleto</h3>
        <p className="mt-2 text-sm text-[#334155]">Se liberara el asiento {ticketToCancel.seatNumber.toString().padStart(2, '0')} del pasajero <span className="font-black uppercase">{ticketToCancel.passengerName}</span>.</p>
        <div className="mt-4 flex items-center gap-2">
          <button onClick={onClose} className="flex-1 rounded-lg border border-black/10 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#334155]">Mantener</button>
          <button onClick={onConfirm} disabled={isProcessing} className="flex-1 rounded-lg bg-[#dc2626] py-2 text-xs font-black uppercase tracking-[0.12em] text-white disabled:opacity-60">{isProcessing ? 'Cancelando...' : 'Confirmar'}</button>
        </div>
      </motion.div>
    </div>
  );
}
