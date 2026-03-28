import { Ticket, Trip } from '../../types';
import { INPUT_CLASS } from './config';

type Props = {
  totalSales: number;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filteredTickets: Ticket[];
  trips: Trip[];
};

export function SalesView({ totalSales, searchTerm, setSearchTerm, filteredTickets, trips }: Props) {
  return (
    <section className="min-h-[calc(100vh-7.3rem)] rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5 lg:p-5">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#0f7666]">Historial</p>
          <h2 className="text-2xl font-black tracking-tight">Ventas de boletos</h2>
        </div>
        <div className="rounded-xl bg-[#0f7666] px-4 py-3 text-right text-white lg:min-w-[210px]">
          <p className="text-[10px] font-black uppercase tracking-[0.16em]">Total</p>
          <p className="text-2xl font-black">${totalSales}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar pasajero" className={`${INPUT_CLASS} w-full py-2 text-sm lg:max-w-sm`} />
        <p className="text-xs text-slate-500">{filteredTickets.length} registros visibles</p>
      </div>

      <div className="hidden overflow-x-auto xl:block">
        <table className="w-full min-w-[760px] text-left">
          <thead>
            <tr className="border-b border-black/10 text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]"><th className="py-3">Fecha</th><th className="py-3">Pasajero</th><th className="py-3">Unidad</th><th className="py-3">Asiento</th><th className="py-3">Descuento</th><th className="py-3">Monto</th><th className="py-3">Estado</th></tr>
          </thead>
          <tbody>
            {filteredTickets.map((ticket) => {
              const tripRef = trips.find((trip) => trip.id === ticket.tripId);
              const discountPercent = ticket.discountPercent ?? 0;
              return (
                <tr key={ticket.id} className="border-b border-black/5 text-sm hover:bg-[#f8fafc]">
                  <td className="py-3">{new Date(ticket.soldAt).toLocaleString()}</td>
                  <td className="py-3 font-black uppercase">{ticket.passengerName}</td>
                  <td className="py-3">#{tripRef?.routeId ?? '-'}</td>
                  <td className="py-3">{ticket.seatNumber.toString().padStart(2, '0')}</td>
                  <td className="py-3">
                    <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${discountPercent > 0 ? 'bg-[#fff1f2] text-[#b91c1c]' : 'bg-[#f1f5f9] text-[#475569]'}`}>
                      {discountPercent > 0 ? `${discountPercent}%` : 'Sin desc'}
                    </span>
                  </td>
                  <td className="py-3 font-black text-[#0f7666]">${ticket.price}</td>
                  <td className="py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${ticket.status === 'cancelled' ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#dcfce7] text-[#166534]'}`}>{ticket.status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:hidden">
        {filteredTickets.map((ticket) => {
          const tripRef = trips.find((trip) => trip.id === ticket.tripId);
          const discountPercent = ticket.discountPercent ?? 0;
          return (
            <article key={ticket.id} className="rounded-2xl border border-black/10 bg-[#fcfffe] p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase text-slate-900">{ticket.passengerName}</p>
                  <p className="mt-1 text-xs text-slate-500">{new Date(ticket.soldAt).toLocaleString()}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${ticket.status === 'cancelled' ? 'bg-[#fee2e2] text-[#b91c1c]' : 'bg-[#dcfce7] text-[#166534]'}`}>{ticket.status}</span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-slate-700 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Unidad</p><p className="mt-1 font-black text-slate-900">#{tripRef?.routeId ?? '-'}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Asiento</p><p className="mt-1 font-black text-slate-900">{ticket.seatNumber.toString().padStart(2, '0')}</p></div>
                <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Descuento</p><p className="mt-1 font-black text-slate-900">{discountPercent > 0 ? `${discountPercent}%` : 'Sin desc'}</p></div>
                <div className="rounded-xl bg-[#ecfdf5] p-3"><p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#0f7666]">Monto</p><p className="mt-1 font-black text-[#0f7666]">${ticket.price}</p></div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
