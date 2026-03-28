import { Bus, Calendar, RefreshCcw, Search } from 'lucide-react';
import { BusLayout } from '../BusLayout';
import { getVehicleTypeLabel, INPUT_CLASS } from './config';
import { SeatInfo, Trip } from '../../types';

type Props = {
  filteredTrips: Trip[];
  selectedTrip: Trip | null;
  selectedSeat: string | null;
  lastPurchasedSeat: string | null;
  soldSeatsCount: number;
  destinationFilter: string;
  dateFilter: string;
  setDestinationFilter: (value: string) => void;
  setDateFilter: (value: string) => void;
  onRefreshTrips: () => void;
  onSelectTrip: (trip: Trip) => void;
  onSelectSeat: (seatId: string) => void;
};

export function SellerView({
  filteredTrips,
  selectedTrip,
  selectedSeat,
  lastPurchasedSeat,
  soldSeatsCount,
  destinationFilter,
  dateFilter,
  setDestinationFilter,
  setDateFilter,
  onRefreshTrips,
  onSelectTrip,
  onSelectSeat,
}: Props) {
  return (
    <section className="grid min-h-[calc(100vh-7.3rem)] grid-cols-1 gap-3 xl:grid-cols-[285px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm sm:p-4 lg:p-3.5 xl:sticky xl:top-[5.5rem] xl:max-h-[calc(100vh-6.4rem)] xl:overflow-hidden">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0f7666]">Corridas</p>
          <button onClick={onRefreshTrips} className="rounded-md p-2 text-[#475569] hover:bg-[#f1f5f9]" title="Actualizar">
            <RefreshCcw className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <input value={destinationFilter} onChange={(event) => setDestinationFilter(event.target.value)} className={`${INPUT_CLASS} py-2 pl-9 text-sm`} placeholder="Filtrar destino" />
          </div>
          <div className="relative">
            <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94a3b8]" />
            <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className={`${INPUT_CLASS} py-2 pl-9 text-sm`} />
          </div>
        </div>

        <div className="mt-3 grid max-h-[44vh] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 xl:max-h-[calc(100vh-13.5rem)] xl:grid-cols-1">
          {filteredTrips.map((trip) => {
            const selected = selectedTrip?.id === trip.id;
            const sold = Object.values(trip.seats as Record<string, SeatInfo>).filter((seat) => seat.status === 'sold').length;
            return (
              <button key={trip.id} onClick={() => onSelectTrip(trip)} className={`w-full rounded-xl border p-3 text-left transition ${selected ? 'border-[#0f7666] bg-[#ecfdf9]' : 'border-black/10 bg-white hover:border-[#67b4a8] hover:bg-[#f8fffd]'}`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-base font-black tracking-tight text-[#0f172a] sm:text-lg">#{trip.routeId}</p>
                  <p className="text-sm font-black text-[#0f7666]">${trip.price}</p>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] font-black uppercase tracking-[0.12em] text-[#64748b]">{trip.origin} {'->'} {trip.destination}</p>
                <div className="mt-2 flex items-start justify-between gap-2 text-xs text-[#475569]">
                  <span className="line-clamp-2">{new Date(trip.departureTime).toLocaleString()}</span>
                  <span>{sold}/{trip.seatCount}</span>
                </div>
                <p className="mt-2 text-[10px] font-black uppercase tracking-[0.1em] text-[#0f7666]">{getVehicleTypeLabel(trip.vehicleType)}</p>
                <p className={`mt-2 inline-flex rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${trip.requiresPassengerName ? 'bg-[#eff6ff] text-[#1d4ed8]' : 'bg-[#ecfdf5] text-[#0f7666]'}`}>
                  {trip.requiresPassengerName ? 'Nombre obligatorio' : 'Sin nombre permitido'}
                </p>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm sm:p-4 lg:p-4 xl:min-h-[calc(100vh-6.4rem)] xl:p-5">
        {selectedTrip ? (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
              <div className="rounded-xl bg-[#0f7666] p-3 text-white"><p className="text-[10px] font-black uppercase tracking-[0.18em]">Unidad</p><p className="mt-1 text-xl font-black tracking-tight sm:text-2xl">#{selectedTrip.routeId}</p></div>
              <div className="rounded-xl bg-[#f0fdfa] p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0f7666]">Tipo</p><p className="mt-1 text-sm font-black uppercase text-[#0f172a]">{getVehicleTypeLabel(selectedTrip.vehicleType)}</p></div>
              <div className="rounded-xl bg-[#fff7ed] p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#c2410c]">Ocupados</p><p className="mt-1 text-xl font-black text-[#9a3412] sm:text-2xl">{soldSeatsCount}</p></div>
              <div className="rounded-xl bg-[#eff6ff] p-3"><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#1d4ed8]">Disponibles</p><p className="mt-1 text-xl font-black text-[#1e3a8a] sm:text-2xl">{selectedTrip.seatCount - soldSeatsCount}</p></div>
            </div>

            <div className="rounded-2xl border border-black/5 bg-[#fcfffe] p-2 sm:p-3 lg:p-4">
              <BusLayout seats={selectedTrip.seats} selectedSeat={selectedSeat} lastPurchasedSeat={lastPurchasedSeat} vehicleType={selectedTrip.vehicleType} seatCount={selectedTrip.seatCount} onSelectSeat={onSelectSeat} />
            </div>
          </>
        ) : (
          <div className="flex h-[56vh] flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-[#f8fafc] px-4 text-center lg:h-[62vh] xl:h-[70vh]">
            <Bus className="h-12 w-12 text-[#94a3b8]" />
            <p className="mt-4 text-sm font-black uppercase tracking-[0.2em] text-[#64748b]">Selecciona una corrida para iniciar ventas</p>
          </div>
        )}
      </section>
    </section>
  );
}
