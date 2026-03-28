import { motion } from 'motion/react';
import { RefreshCcw, Ticket as TicketIcon, X } from 'lucide-react';
import { DiscountConfig, Trip } from '../../types';
import { BTN_PRIMARY, INPUT_CLASS } from './config';
import { FareType, getDiscountByFareType, roundMoney } from '../../lib/discounts';

type Props = {
  open: boolean;
  selectedTrip: Trip | null;
  selectedSeat: string | null;
  passengerName: string;
  fareType: FareType;
  discountConfig: DiscountConfig;
  setPassengerName: (name: string) => void;
  setFareType: (fareType: FareType) => void;
  isProcessing: boolean;
  onClose: () => void;
  onBuy: () => void;
};

export function SaleModal({
  open,
  selectedTrip,
  selectedSeat,
  passengerName,
  fareType,
  discountConfig,
  setPassengerName,
  setFareType,
  isProcessing,
  onClose,
  onBuy,
}: Props) {
  if (!open || !selectedTrip || !selectedSeat) return null;
  const requiresPassengerName = selectedTrip.requiresPassengerName !== false;

  const activeDiscount = getDiscountByFareType(fareType, discountConfig);
  const basePrice = Number(selectedTrip.price);
  const discountAmount = roundMoney(basePrice * (activeDiscount.percent / 100));
  const finalPrice = roundMoney(basePrice - discountAmount);

  const fareOptions: Array<{ value: FareType; label: string; visible: boolean }> = [
    { value: 'adult' as FareType, label: 'Boleto regular', visible: true },
    {
      value: 'child' as FareType,
      label: `Nino (${discountConfig.childPercent}% desc)`,
      visible: discountConfig.childEnabled,
    },
    {
      value: 'senior' as FareType,
      label: `Adulto mayor (${discountConfig.seniorPercent}% desc)`,
      visible: discountConfig.seniorEnabled,
    },
    {
      value: 'disability' as FareType,
      label: `Discapacidad (${discountConfig.disabilityPercent}% desc)`,
      visible: discountConfig.disabilityEnabled,
    },
  ].filter((option) => option.visible);

  const fareLabel = fareOptions.find((option) => option.value === fareType)?.label ?? 'Boleto regular';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/55" />
      <motion.div initial={{ opacity: 0, y: 16, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="relative w-full max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black tracking-tight">Asiento {selectedSeat.padStart(2, '0')}</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-[#f1f5f9]"><X className="h-4 w-4" /></button>
        </div>

        {selectedTrip.seats[selectedSeat]?.status === 'sold' ? (
          <div className="rounded-xl border border-[#f59e0b]/30 bg-[#fffbeb] p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.15em] text-[#b45309]">Ocupado</p>
            <p className="mt-2 text-sm font-black uppercase text-[#78350f]">{selectedTrip.seats[selectedSeat]?.passengerName ?? 'Pasajero registrado'}</p>
            <p className="mt-1 text-xs text-[#92400e]">{selectedTrip.seats[selectedSeat]?.soldAt ? new Date(selectedTrip.seats[selectedSeat].soldAt as string).toLocaleString() : 'Sin fecha'}</p>
          </div>
        ) : (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-[#ecfdf5] p-3"><p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#166534]">Unidad</p><p className="mt-1 text-xl font-black">#{selectedTrip.routeId}</p></div>
              <div className="rounded-xl bg-[#eff6ff] p-3 text-right"><p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#1d4ed8]">Tarifa base</p><p className="mt-1 text-xl font-black text-[#1e40af]">${basePrice}</p></div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <input
                autoFocus
                value={passengerName}
                onChange={(event) => setPassengerName(event.target.value)}
                placeholder={requiresPassengerName ? 'Nombre del pasajero (obligatorio)' : 'Nombre del pasajero (opcional)'}
                className={INPUT_CLASS}
              />
              <p className="text-[11px] font-semibold text-[#64748b]">
                {requiresPassengerName
                  ? 'Esta corrida requiere capturar nombre del pasajero.'
                  : 'Esta corrida permite boleto sin nombre (registro general).'}
              </p>
              <div className="rounded-xl border border-black/10 bg-white p-2">
                <p className="mb-2 px-1 text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">Tipo de boleto</p>
                <select
                  value={fareType}
                  onChange={(event) => setFareType(event.target.value as FareType)}
                  className={`${INPUT_CLASS} py-2 text-sm font-black uppercase tracking-[0.08em]`}
                >
                  {fareOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-black/10 bg-[#f8fafc] p-3 text-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">Tipo de tarifa</p>
              <p className="mt-1 font-black text-[#0f172a]">{fareLabel}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <div><p className="text-[#64748b]">Base</p><p className="font-black">${basePrice}</p></div>
                <div><p className="text-[#64748b]">Descuento</p><p className="font-black text-[#b91c1c]">-${discountAmount}</p></div>
                <div><p className="text-[#64748b]">Total</p><p className="font-black text-[#0f7666]">${finalPrice}</p></div>
              </div>
              {fareType === 'adult' && <p className="mt-2 text-xs font-semibold text-[#64748b]">Aplicando tarifa regular sin descuento.</p>}
            </div>

            <button
              disabled={(requiresPassengerName && !passengerName.trim()) || isProcessing}
              onClick={onBuy}
              className={`${BTN_PRIMARY} mt-4 w-full py-3 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {isProcessing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <TicketIcon className="h-4 w-4" />}
              <span>Emitir boleto</span>
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
