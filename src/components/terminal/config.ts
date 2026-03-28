import { VehicleType } from '../../types';

export type ViewMode = 'seller' | 'sales' | 'driver' | 'admin';
export type AdminTab = 'dashboard' | 'create' | 'trips' | 'sales' | 'expenses' | 'staff' | 'branding';

export type Branding = {
  companyName: string;
  logoUrl: string;
  heroImageUrl: string;
  heroImages: string[];
  tagline: string;
};

export const DEFAULT_BRANDING: Branding = {
  companyName: 'Terminal AU',
  logoUrl: '',
  heroImageUrl:
    'https://images.unsplash.com/photo-1509749837427-ac94a2553d0e?auto=format&fit=crop&w=1600&q=80',
  heroImages: [
    'https://images.unsplash.com/photo-1509749837427-ac94a2553d0e?auto=format&fit=crop&w=1600&q=80',
  ],
  tagline: 'Venta de boletos sin friccion.',
};

export const BTN_PRIMARY =
  'inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#0f7666] via-[#059669] to-[#16a34a] px-4 font-extrabold uppercase tracking-[0.12em] text-white shadow-[0_16px_40px_rgba(5,150,105,0.28)] transition duration-300 hover:-translate-y-0.5 hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200';

export const INPUT_CLASS =
  'w-full rounded-2xl border border-slate-200/80 bg-[#f4f8fb]/90 px-4 py-3 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] outline-none transition duration-300 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100';

export const VEHICLE_TYPE_OPTIONS: Array<{ value: VehicleType; label: string; seatCount: number }> = [
  { value: 'sprinter', label: 'Sprinter', seatCount: 15 },
  { value: 'minibus', label: 'Minibus', seatCount: 28 },
  { value: 'autobus', label: 'Autobus', seatCount: 40 },
  { value: 'autobus_xl', label: 'Autobus XL', seatCount: 60 },
];

export function getVehicleTypeLabel(vehicleType: VehicleType): string {
  return VEHICLE_TYPE_OPTIONS.find((option) => option.value === vehicleType)?.label ?? 'Autobus';
}
