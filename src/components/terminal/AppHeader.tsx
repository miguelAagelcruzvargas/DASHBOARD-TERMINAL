import { Bus, LogOut, Shield } from 'lucide-react';
import { ViewMode, Branding } from './config';

type Props = {
  view: ViewMode;
  canAccessSalesViews: boolean;
  canOpenAdminGate: boolean;
  canOpenDriverView: boolean;
  userEmail?: string | null;
  branding: Branding;
  onGoSeller: () => void;
  onGoSales: () => void;
  onGoDriver: () => void;
  onOpenAdmin: () => void;
  onLogout: () => void;
};

export function AppHeader({
  view,
  canAccessSalesViews,
  canOpenAdminGate,
  canOpenDriverView,
  userEmail,
  branding,
  onGoSeller,
  onGoSales,
  onGoDriver,
  onOpenAdmin,
  onLogout,
}: Props) {
  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/88 px-3 py-2 backdrop-blur-xl sm:px-4 lg:px-5">
      <div className="mx-auto grid w-full max-w-[1680px] grid-cols-[minmax(0,1fr)_auto] items-center gap-3 lg:flex lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#0f7666] p-1.5 text-white shadow-md shadow-[#0f7666]/25 sm:h-10 sm:w-10">
            {branding.logoUrl ? <img src={branding.logoUrl} alt="Logo" className="h-full w-full object-contain" /> : <Bus className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.24em] text-[#0f7666] sm:tracking-[0.3em]">{branding.companyName}</p>
            <p className="truncate text-[11px] text-[#64748b]">{userEmail}</p>
          </div>
        </div>

        <div className="col-span-2 flex w-full items-center justify-between gap-2 lg:col-auto lg:w-auto lg:justify-end">
          <div className="flex min-w-0 flex-1 items-center gap-1 rounded-xl border border-black/10 bg-white p-1 lg:flex-none">
            {canAccessSalesViews && (
              <button onClick={onGoSeller} className={`min-w-0 flex-1 rounded-lg px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition sm:px-3 sm:text-[11px] ${view === 'seller' ? 'bg-[#0f7666] text-white' : 'text-[#475569] hover:bg-[#f1f5f9]'}`}>
              Venta
              </button>
            )}
            {canAccessSalesViews && (
              <button onClick={onGoSales} className={`min-w-0 flex-1 rounded-lg px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition sm:px-3 sm:text-[11px] ${view === 'sales' ? 'bg-[#0f7666] text-white' : 'text-[#475569] hover:bg-[#f1f5f9]'}`}>
              Historial
              </button>
            )}
            {canOpenDriverView && (
              <button onClick={onGoDriver} className={`min-w-0 flex-1 rounded-lg px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.08em] transition sm:px-3 sm:text-[11px] ${view === 'driver' ? 'bg-[#0f7666] text-white' : 'text-[#475569] hover:bg-[#f1f5f9]'}`}>
              Chofer
              </button>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {canOpenAdminGate && (
              <button onClick={onOpenAdmin} className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#334155] hover:bg-[#f8fafc] sm:px-3">
                <Shield className="h-4 w-4" />
                <span className="hidden xl:inline">Administrador</span>
              </button>
            )}
            <button onClick={onLogout} className="inline-flex items-center gap-2 rounded-lg border border-black/10 bg-white px-2.5 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#b91c1c] hover:bg-[#fef2f2] sm:px-3">
              <LogOut className="h-4 w-4" />
              <span className="hidden xl:inline">Salir</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
