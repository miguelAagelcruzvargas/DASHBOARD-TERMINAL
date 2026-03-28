import React from 'react';
import { motion } from 'motion/react';
import { Check, Lock, User } from 'lucide-react';
import { SeatInfo, VehicleType } from '../types';
import { getVehicleTypeLabel } from './terminal/config';

const VEHICLE_LAYOUTS: Record<VehicleType, {
  leftSeats: number;
  rightSeats: number;
  shellWidthClass: string;
  seatSizeClass: string;
  aisleClass: string;
  layoutLabel: string;
}> = {
  sprinter: {
    leftSeats: 1,
    rightSeats: 2,
    shellWidthClass: 'max-w-[430px]',
    seatSizeClass: 'h-10 w-8 sm:h-11 sm:w-9 lg:h-12 lg:w-10',
    aisleClass: 'w-5 sm:w-7 lg:w-8',
    layoutLabel: '1 + 2',
  },
  minibus: {
    leftSeats: 2,
    rightSeats: 2,
    shellWidthClass: 'max-w-[500px]',
    seatSizeClass: 'h-10 w-8 sm:h-11 sm:w-9 lg:h-12 lg:w-10',
    aisleClass: 'w-5 sm:w-7 lg:w-8',
    layoutLabel: '2 + 2 compacto',
  },
  autobus: {
    leftSeats: 2,
    rightSeats: 2,
    shellWidthClass: 'max-w-[560px]',
    seatSizeClass: 'h-10 w-8 sm:h-11 sm:w-9 lg:h-14 lg:w-12',
    aisleClass: 'w-6 sm:w-8 lg:w-10',
    layoutLabel: '2 + 2 estandar',
  },
  autobus_xl: {
    leftSeats: 2,
    rightSeats: 2,
    shellWidthClass: 'max-w-[660px]',
    seatSizeClass: 'h-10 w-8 sm:h-11 sm:w-9 lg:h-14 lg:w-12',
    aisleClass: 'w-7 sm:w-9 lg:w-12',
    layoutLabel: '2 + 2 amplio',
  },
};

interface BusLayoutProps {
  seats: Record<string, SeatInfo>;
  selectedSeat: string | null;
  lastPurchasedSeat: string | null;
  vehicleType: VehicleType;
  seatCount: number;
  onSelectSeat: (seatId: string) => void;
}

export const BusLayout: React.FC<BusLayoutProps> = ({
  seats,
  selectedSeat,
  lastPurchasedSeat,
  vehicleType,
  seatCount,
  onSelectSeat,
}) => {
  const layout = VEHICLE_LAYOUTS[vehicleType] ?? VEHICLE_LAYOUTS.autobus;
  const seatsPerRow = layout.leftSeats + layout.rightSeats;
  const rows = Math.ceil(seatCount / seatsPerRow);
  const soldCount = Object.values(seats as Record<string, SeatInfo>).filter((seat) => seat.status === 'sold').length;
  const availableCount = seatCount - soldCount;

  const renderSeat = (seatId: string) => {
    const seat = seats[seatId] ?? { status: 'available' };
    const isSold = seat.status === 'sold';
    const isSelected = selectedSeat === seatId;
    const isJustPurchased = lastPurchasedSeat === seatId;

    return (
      <button
        key={seatId}
        onClick={() => onSelectSeat(seatId)}
        disabled={isSold}
        title={isSold ? 'Asiento ocupado' : `Asiento ${seatId}`}
        className={`relative ${layout.seatSizeClass} rounded-xl border text-center transition ${
          isSold
            ? 'cursor-not-allowed border-[#fecaca] bg-[#fff1f2] text-[#b91c1c]'
            : isSelected
              ? 'border-[#0f7666] bg-[#0f7666] text-white shadow-lg shadow-[#0f7666]/30'
              : 'border-black/10 bg-white text-[#334155] hover:border-[#67b4a8] hover:bg-[#f0fdfa]'
        }`}
      >
        {isJustPurchased && (
          <motion.div
            initial={{ opacity: 0.6, scale: 1 }}
            animate={{ opacity: 0, scale: 1.8 }}
            transition={{ duration: 0.9, repeat: Infinity }}
            className="pointer-events-none absolute inset-0 rounded-xl border-2 border-[#10b981]"
          />
        )}

        <span className="text-[11px] font-black tracking-tight sm:text-xs">{seatId.padStart(2, '0')}</span>

        {isSold && (
          <span className="absolute right-1 top-1 rounded-full bg-[#ef4444] p-0.5 text-white">
            <Lock className="h-2.5 w-2.5" />
          </span>
        )}

        {isJustPurchased && (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-[#10b981] p-1 text-white shadow-lg">
            <Check className="h-2.5 w-2.5" />
          </span>
        )}

        <span className={`pointer-events-none absolute bottom-1 left-1/2 h-1.5 w-6 -translate-x-1/2 rounded-full ${isSold ? 'bg-[#ef4444]/20' : 'bg-black/10'}`} />
      </button>
    );
  };

  const renderSeatPlaceholder = (slotKey: string) => <div key={slotKey} className={layout.seatSizeClass} />;

  return (
    <div className="w-full">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-2.5 py-1 sm:px-3">
          <span className="h-3 w-3 rounded bg-white shadow-inner ring-1 ring-black/10" /> Disponible
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#0f7666]/30 bg-[#ecfdf5] px-2.5 py-1 text-[#0f7666] sm:px-3">
          <span className="h-3 w-3 rounded bg-[#0f7666]" /> Seleccionado
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-[#fecaca] bg-[#fff1f2] px-2.5 py-1 text-[#b91c1c] sm:px-3">
          <User className="h-3 w-3" /> Ocupado
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-[#dcfce7] bg-[#f0fdf4] px-3 py-2 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#166534]">Disponibles</p>
          <p className="mt-1 text-xl font-black text-[#14532d]">{availableCount}</p>
        </div>
        <div className="rounded-xl border border-[#fecaca] bg-[#fff1f2] px-3 py-2 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#b91c1c]">Vendidos</p>
          <p className="mt-1 text-xl font-black text-[#991b1b]">{soldCount}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-black/10 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b] sm:px-4">
        <span>{getVehicleTypeLabel(vehicleType)}</span>
        <span>{layout.layoutLabel}</span>
        <span>{seatCount} asientos</span>
      </div>

      <div className={`relative mx-auto w-full ${layout.shellWidthClass} rounded-[2rem] border border-black/10 bg-gradient-to-b from-white to-[#f8fffd] p-3 shadow-[0_20px_50px_rgba(15,23,42,0.08)] sm:rounded-[2.25rem] sm:p-4 lg:rounded-[2.5rem] lg:p-6`}>
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-[#bbf7d0] bg-[#ecfdf5] px-4 py-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0f7666]">Frente</p>
          <div className="h-4 w-12 rounded-full bg-[#0f7666]/20" />
        </div>

        <div className="space-y-2.5 sm:space-y-3 lg:space-y-4">
          {Array.from({ length: rows }).map((_, rowIndex) => {
            const rowStart = rowIndex * seatsPerRow + 1;
            const leftSeatIds = Array.from({ length: layout.leftSeats }, (_, index) => rowStart + index);
            const rightSeatIds = Array.from({ length: layout.rightSeats }, (_, index) => rowStart + layout.leftSeats + index);

            return (
              <div key={rowIndex} className="flex items-center justify-center gap-1.5 sm:gap-2 lg:gap-3">
                <div className="flex justify-end gap-1.5 sm:gap-2 lg:gap-3">
                  {leftSeatIds.map((seatId) => (seatId <= seatCount ? renderSeat(String(seatId)) : renderSeatPlaceholder(`left-${rowIndex}-${seatId}`)))}
                </div>
                <div className={`flex items-center justify-center ${layout.aisleClass}`}>
                  <div className="h-full w-[2px] rounded-full bg-[#bae6fd]" />
                </div>
                <div className="flex justify-start gap-1.5 sm:gap-2 lg:gap-3">
                  {rightSeatIds.map((seatId) => (seatId <= seatCount ? renderSeat(String(seatId)) : renderSeatPlaceholder(`right-${rowIndex}-${seatId}`)))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-2xl border border-black/10 bg-white px-4 py-2 text-center text-[10px] font-black uppercase tracking-[0.18em] text-[#64748b]">
          Parte trasera
        </div>
      </div>
    </div>
  );
};
