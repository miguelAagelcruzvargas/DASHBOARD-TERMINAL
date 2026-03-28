import { motion } from 'motion/react';
import { Bus, Ticket as TicketIcon } from 'lucide-react';
import { Ticket } from '../../types';
import { Branding } from './config';

type Props = {
  open: boolean;
  lastSoldTicket: Ticket | null;
  branding: Branding;
  onClose: () => void;
};

export function TicketModal({ open, lastSoldTicket, branding, onClose }: Props) {
  if (!open || !lastSoldTicket) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/65" />
      <motion.div initial={{ opacity: 0, scale: 0.94, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94, y: 8 }} className="relative w-full max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-2xl">
        <div id="printable-ticket" className="space-y-4">
          <div className="flex items-center justify-between border-b border-black/10 pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-[#0f7666] p-1.5 text-white">
                {branding.logoUrl ? <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-contain" /> : <Bus className="h-5 w-5" />}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0f7666]">{branding.companyName}</p>
                <p className="text-sm font-black">Boleto de viaje</p>
              </div>
            </div>
            <TicketIcon className="h-6 w-6 text-[#0f7666]" />
          </div>

          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-[#f8fafc] p-3"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">Pasajero</p><p className="mt-1 font-black uppercase">{lastSoldTicket.passengerName}</p></div>
            <div className="rounded-xl bg-[#f8fafc] p-3 text-right"><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">Asiento</p><p className="mt-1 text-xl font-black">{lastSoldTicket.seatNumber.toString().padStart(2, '0')}</p></div>
          </div>

          <div className="rounded-xl border border-black/10 p-3 text-sm">
            <p><span className="font-black">Edad:</span> {(lastSoldTicket as Ticket & { passengerAge?: number | null }).passengerAge ?? '-'}</p>
            <p><span className="font-black">Unidad:</span> #{(lastSoldTicket as Ticket & { routeId?: string }).routeId ?? '-'}</p>
            <p><span className="font-black">Ruta:</span> {(lastSoldTicket as Ticket & { origin?: string }).origin ?? 'TERMINAL AU'} {'->'} {(lastSoldTicket as Ticket & { destination?: string }).destination ?? '-'}</p>
            <p><span className="font-black">Salida:</span> {new Date((lastSoldTicket as Ticket & { departureTime?: string }).departureTime ?? lastSoldTicket.soldAt).toLocaleString()}</p>
            <p><span className="font-black">Tarifa base:</span> ${(lastSoldTicket as Ticket & { basePrice?: number }).basePrice ?? lastSoldTicket.price}</p>
            <p><span className="font-black">Descuento:</span> {(lastSoldTicket as Ticket & { discountPercent?: number }).discountPercent ?? 0}%</p>
            <p><span className="font-black">Total:</span> ${lastSoldTicket.price}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button onClick={() => window.print()} className="flex-1 rounded-lg bg-[#0f7666] py-2 text-xs font-black uppercase tracking-[0.12em] text-white">Imprimir</button>
          <button onClick={onClose} className="rounded-lg border border-black/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#334155]">Cerrar</button>
        </div>
      </motion.div>
    </div>
  );
}
