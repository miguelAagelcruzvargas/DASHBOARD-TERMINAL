import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import L from 'leaflet';
import { AlertTriangle, BusFront, CalendarDays, ChartColumn, CreditCard, Landmark, Plus, Receipt, Ticket as TicketIcon, Trash2, Wallet } from 'lucide-react';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import { CashShift, DiscountConfig, EmployeeSchedule, EmployeeUser, Expense, ExpenseCategory, OperationsContextUnit, OperationsKpi, SeatInfo, Ticket, Trip, VehicleRecord, VehicleType } from '../../types';
import { AdminTab, Branding, BTN_PRIMARY, getVehicleTypeLabel, INPUT_CLASS, VEHICLE_TYPE_OPTIONS } from './config';
import { StaffManagementPanel } from './StaffManagementPanel';

type RouteOption = {
  key: string;
  origin: string;
  destination: string;
  price: number;
};

type GeoPoint = {
  lat: number;
  lon: number;
};

const DEFAULT_MAP_CENTER: [number, number] = [17.0732, -96.7266];

const currencyFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('es-MX');

const monthFormatter = new Intl.DateTimeFormat('es-MX', { month: 'short' });
const weekdayFormatter = new Intl.DateTimeFormat('es-MX', { weekday: 'short' });

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  const base = startOfDay(date);
  base.setDate(base.getDate() + offset);
  return base;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function isSameDay(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}

function isWithinRange(target: Date, start: Date, end: Date): boolean {
  return target >= start && target < end;
}

function formatCurrency(value: number): string {
  return currencyFormatter.format(Math.round(value));
}

function formatCompactNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

const ADMIN_TABS: Array<{ key: AdminTab; label: string }> = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'create', label: 'Create' },
  { key: 'trips', label: 'Trips' },
  { key: 'sales', label: 'Sales' },
  { key: 'expenses', label: 'Gastos' },
  { key: 'staff', label: 'Personal y Sucursales' },
  { key: 'branding', label: 'Branding' },
];

const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategory, string> = {
  fixed: 'Gasto fijo',
  variable: 'Gasto variable',
  payroll: 'Pago de trabajador',
};

const EXPENSE_CATEGORY_TONE: Record<ExpenseCategory, string> = {
  fixed: 'bg-sky-50 text-sky-700 border-sky-100',
  variable: 'bg-amber-50 text-amber-700 border-amber-100',
  payroll: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

const PAYMENT_METHOD_LABEL: Record<'cash' | 'transfer' | 'card' | 'other', string> = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
  card: 'Tarjeta',
  other: 'Otro',
};

const markerIcon = new L.Icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

async function geocodePlace(query: string): Promise<GeoPoint | null> {
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`,
    {
      headers: { Accept: 'application/json' },
    },
  );
  if (!response.ok) return null;

  const data = (await response.json()) as Array<{ lat: string; lon: string }>;
  const first = data[0];
  if (!first) return null;

  return {
    lat: Number.parseFloat(first.lat),
    lon: Number.parseFloat(first.lon),
  };
}

async function fetchRoute(origin: GeoPoint, destination: GeoPoint): Promise<[number, number][]> {
  const response = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${destination.lon},${destination.lat}?overview=full&geometries=geojson`,
  );
  if (!response.ok) return [];

  const data = (await response.json()) as {
    routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
  };

  const coordinates = data.routes?.[0]?.geometry?.coordinates ?? [];
  return coordinates.map(([lon, lat]) => [lat, lon]);
}

type Props = {
  adminTab: AdminTab;
  setAdminTab: (tab: AdminTab) => void;
  isAdminByEmail: boolean;
  totalSales: number;
  tickets: Ticket[];
  expenses: Expense[];
  currentShift: CashShift | null;
  shiftHistory: CashShift[];
  operationsKpi: OperationsKpi | null;
  operationsContext: OperationsContextUnit[];
  selectedBranchId: string;
  setSelectedBranchId: (value: string) => void;
  selectedTerminalId: string;
  setSelectedTerminalId: (value: string) => void;
  employeeUsers: EmployeeUser[];
  employeeSchedules: EmployeeSchedule[];
  newEmployee: { fullName: string; email: string; password: string; role: 'admin' | 'seller' | 'driver'; branchId: string; terminalId: string };
  setNewEmployee: (value: { fullName: string; email: string; password: string; role: 'admin' | 'seller' | 'driver'; branchId: string; terminalId: string }) => void;
  createEmployee: () => void;
  toggleEmployeeStatus: (employee: EmployeeUser) => void;
  newSchedule: { userId: string; branchId: string; terminalId: string; dayOfWeek: number; startTime: string; endTime: string; notes: string };
  setNewSchedule: (value: { userId: string; branchId: string; terminalId: string; dayOfWeek: number; startTime: string; endTime: string; notes: string }) => void;
  createEmployeeSchedule: () => void;
  deleteEmployeeSchedule: (scheduleId: string) => void;
  newBranch: { code: string; name: string };
  setNewBranch: (value: { code: string; name: string }) => void;
  createBranch: () => void;
  newTerminal: { branchId: string; code: string; name: string };
  setNewTerminal: (value: { branchId: string; code: string; name: string }) => void;
  createTerminal: () => void;
  vehicles: VehicleRecord[];
  newVehicle: {
    branchId: string;
    terminalId: string;
    plateNumber: string;
    internalCode: string;
    vehicleType: VehicleType;
    capacity: number;
    operationalStatus: 'active' | 'maintenance' | 'inactive';
    photoUrl: string;
    notes: string;
    lastInspectionAt: string;
  };
  setNewVehicle: (value: {
    branchId: string;
    terminalId: string;
    plateNumber: string;
    internalCode: string;
    vehicleType: VehicleType;
    capacity: number;
    operationalStatus: 'active' | 'maintenance' | 'inactive';
    photoUrl: string;
    notes: string;
    lastInspectionAt: string;
  }) => void;
  createVehicle: () => void;
  updateVehicleStatus: (vehicleId: string, operationalStatus: 'active' | 'maintenance' | 'inactive') => void;
  shiftOpeningCash: number;
  setShiftOpeningCash: (value: number) => void;
  shiftClosingCash: number;
  setShiftClosingCash: (value: number) => void;
  shiftClosingNote: string;
  setShiftClosingNote: (value: string) => void;
  openShift: () => void;
  closeShift: () => void;
  trips: Trip[];
  newTrip: { routeId: string; origin: string; destination: string; requiresPassengerName: boolean; vehicleType: VehicleType; seatCount: number; price: number; departureTime: string };
  setNewTrip: (next: { routeId: string; origin: string; destination: string; requiresPassengerName: boolean; vehicleType: VehicleType; seatCount: number; price: number; departureTime: string }) => void;
  createTrip: () => void;
  newExpense: { category: ExpenseCategory; title: string; description: string; amount: number; expenseDate: string; paymentMethod: 'cash' | 'transfer' | 'card' | 'other'; notes: string };
  setNewExpense: (next: { category: ExpenseCategory; title: string; description: string; amount: number; expenseDate: string; paymentMethod: 'cash' | 'transfer' | 'card' | 'other'; notes: string }) => void;
  createExpense: () => void;
  deleteExpense: (expenseId: string) => void;
  handleResetTrip: (tripId: string, routeId: string) => void;
  handleDeleteTrip: (tripId: string, routeId: string) => void;
  handleCancelTicket: (ticket: Ticket) => void;
  setLastSoldTicket: (ticket: Ticket) => void;
  setShowTicketModal: (value: boolean) => void;
  brandingDraft: Branding;
  setBrandingDraft: (value: Branding) => void;
  saveBranding: () => void;
  discountConfig: DiscountConfig;
  setDiscountConfig: (value: DiscountConfig) => void;
  saveDiscountConfig: () => void;
  discountConfigSaving: boolean;
};

type ConfirmModalState = {
  title: string;
  message: string;
  actionLabel: string;
  actionTone?: 'neutral' | 'danger';
  onConfirm: () => void;
} | null;

export function AdminView({
  adminTab,
  setAdminTab,
  isAdminByEmail,
  totalSales,
  tickets,
  expenses,
  currentShift,
  shiftHistory,
  operationsKpi,
  operationsContext,
  selectedBranchId,
  setSelectedBranchId,
  selectedTerminalId,
  setSelectedTerminalId,
  employeeUsers,
  employeeSchedules,
  newEmployee,
  setNewEmployee,
  createEmployee,
  toggleEmployeeStatus,
  newSchedule,
  setNewSchedule,
  createEmployeeSchedule,
  deleteEmployeeSchedule,
  newBranch,
  setNewBranch,
  createBranch,
  newTerminal,
  setNewTerminal,
  createTerminal,
  vehicles,
  newVehicle,
  setNewVehicle,
  createVehicle,
  updateVehicleStatus,
  shiftOpeningCash,
  setShiftOpeningCash,
  shiftClosingCash,
  setShiftClosingCash,
  shiftClosingNote,
  setShiftClosingNote,
  openShift,
  closeShift,
  trips,
  newTrip,
  setNewTrip,
  createTrip,
  newExpense,
  setNewExpense,
  createExpense,
  deleteExpense,
  handleResetTrip,
  handleDeleteTrip,
  handleCancelTicket,
  setLastSoldTicket,
  setShowTicketModal,
  brandingDraft,
  setBrandingDraft,
  saveBranding,
  discountConfig,
  setDiscountConfig,
  saveDiscountConfig,
  discountConfigSaving,
}: Props) {
  const routeMap = new Map<string, RouteOption>();
  trips.forEach((trip) => {
    const key = `${trip.origin}::${trip.destination}`;
    if (!routeMap.has(key)) {
      routeMap.set(key, {
        key,
        origin: trip.origin,
        destination: trip.destination,
        price: trip.price,
      });
    }
  });
  const routeOptions = Array.from(routeMap.values());
  const routePairs = routeOptions.map((route) => `${route.origin} -> ${route.destination}`);
  const selectedRouteKey = `${newTrip.origin}::${newTrip.destination}`;
  const originOptions = Array.from(new Set(trips.map((trip) => trip.origin))).sort((a, b) => a.localeCompare(b));
  const destinationOptions = Array.from(new Set(trips.map((trip) => trip.destination))).sort((a, b) => a.localeCompare(b));

  const [originPoint, setOriginPoint] = useState<GeoPoint | null>(null);
  const [destinationPoint, setDestinationPoint] = useState<GeoPoint | null>(null);
  const [routeLine, setRouteLine] = useState<[number, number][]>([]);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>(null);
  const [heroUrlInput, setHeroUrlInput] = useState('');

  const requestConfirmation = (payload: NonNullable<ConfirmModalState>) => {
    setConfirmModal(payload);
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('file_read_failed'));
      reader.readAsDataURL(file);
    });
  };

  const safeHeroImages = (brandingDraft.heroImages ?? []).filter((item) => item.trim().length > 0).slice(0, 4);
  const previewHeroImage = safeHeroImages[0] || brandingDraft.heroImageUrl || '';

  const updateHeroImages = (nextImages: string[]) => {
    const normalized = nextImages.filter((item) => item.trim().length > 0).slice(0, 4);
    setBrandingDraft({
      ...brandingDraft,
      heroImages: normalized,
      heroImageUrl: normalized[0] || brandingDraft.heroImageUrl,
    });
  };

  const handleLogoFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      setBrandingDraft({ ...brandingDraft, logoUrl: dataUrl });
    } catch (_error) {
      // ignore file read errors
    } finally {
      event.target.value = '';
    }
  };

  const handleHeroFilesChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files: File[] = event.target.files ? Array.from(event.target.files) : [];
    if (files.length === 0) return;

    const remainingSlots = 4 - safeHeroImages.length;
    if (remainingSlots <= 0) {
      event.target.value = '';
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith('image/')).slice(0, remainingSlots);
    try {
      const uploaded = await Promise.all(imageFiles.map((file) => fileToDataUrl(file)));
      updateHeroImages([...safeHeroImages, ...uploaded]);
    } catch (_error) {
      // ignore file read errors
    } finally {
      event.target.value = '';
    }
  };

  const addHeroUrl = () => {
    const value = heroUrlInput.trim();
    if (!value || safeHeroImages.length >= 4) return;
    updateHeroImages([...safeHeroImages, value]);
    setHeroUrlInput('');
  };

  const removeHeroImage = (index: number) => {
    updateHeroImages(safeHeroImages.filter((_, i) => i !== index));
  };

  const setAsPrimaryHero = (index: number) => {
    const target = safeHeroImages[index];
    if (!target) return;
    const reordered = [target, ...safeHeroImages.filter((_, i) => i !== index)];
    updateHeroImages(reordered);
  };

  useEffect(() => {
    if (adminTab !== 'create') return;

    const origin = newTrip.origin.trim();
    const destination = newTrip.destination.trim();

    if (!origin || !destination) {
      setOriginPoint(null);
      setDestinationPoint(null);
      setRouteLine([]);
      setMapError(null);
      return;
    }

    let cancelled = false;
    setMapLoading(true);
    setMapError(null);

    const timer = window.setTimeout(async () => {
      try {
        const [originGeo, destinationGeo] = await Promise.all([
          geocodePlace(origin),
          geocodePlace(destination),
        ]);

        if (cancelled) return;

        if (!originGeo || !destinationGeo) {
          setOriginPoint(originGeo);
          setDestinationPoint(destinationGeo);
          setRouteLine([]);
          setMapError('No se encontro alguna ubicacion para la ruta.');
          return;
        }

        const route = await fetchRoute(originGeo, destinationGeo);
        if (cancelled) return;

        setOriginPoint(originGeo);
        setDestinationPoint(destinationGeo);
        setRouteLine(route);
        if (route.length === 0) {
          setMapError('No se pudo calcular el recorrido en este momento.');
        }
      } catch (_error) {
        if (!cancelled) {
          setMapError('Error consultando mapa gratuito. Intenta de nuevo.');
          setRouteLine([]);
        }
      } finally {
        if (!cancelled) setMapLoading(false);
      }
    }, 450);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [adminTab, newTrip.destination, newTrip.origin]);

  const mapCenter = useMemo<[number, number]>(() => {
    if (originPoint && destinationPoint) {
      return [(originPoint.lat + destinationPoint.lat) / 2, (originPoint.lon + destinationPoint.lon) / 2];
    }
    if (originPoint) return [originPoint.lat, originPoint.lon];
    if (destinationPoint) return [destinationPoint.lat, destinationPoint.lon];
    return DEFAULT_MAP_CENTER;
  }, [destinationPoint, originPoint]);

  const dashboardMetrics = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now);
    const tomorrowStart = addDays(todayStart, 1);
    const weekStart = startOfWeek(now);
    const nextWeekStart = addDays(weekStart, 7);
    const monthStart = startOfMonth(now);
    const nextMonthStart = addMonths(monthStart, 1);
    const yearStart = startOfYear(now);
    const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);

    const activeTickets = tickets.filter((ticket) => ticket.status !== 'cancelled');
    const cancelledTickets = tickets.filter((ticket) => ticket.status === 'cancelled');

    const activeRevenue = activeTickets.reduce((sum, ticket) => sum + ticket.price, 0);
    const lostRevenue = cancelledTickets.reduce((sum, ticket) => sum + ticket.price, 0);
    const grossRevenue = activeRevenue + lostRevenue;

    const soldToday = activeTickets.filter((ticket) => isWithinRange(new Date(ticket.soldAt), todayStart, tomorrowStart));
    const soldWeek = activeTickets.filter((ticket) => isWithinRange(new Date(ticket.soldAt), weekStart, nextWeekStart));
    const soldMonth = activeTickets.filter((ticket) => isWithinRange(new Date(ticket.soldAt), monthStart, nextMonthStart));
    const soldYear = activeTickets.filter((ticket) => isWithinRange(new Date(ticket.soldAt), yearStart, nextYearStart));

    const tripsToday = trips.filter((trip) => isSameDay(new Date(trip.departureTime), now));
    const tripsWeek = trips.filter((trip) => isWithinRange(new Date(trip.departureTime), weekStart, nextWeekStart));
    const tripsMonth = trips.filter((trip) => isWithinRange(new Date(trip.departureTime), monthStart, nextMonthStart));
    const tripsYear = trips.filter((trip) => isWithinRange(new Date(trip.departureTime), yearStart, nextYearStart));

    const totalSeats = trips.reduce((sum, trip) => sum + trip.seatCount, 0);
    const occupancyRate = totalSeats > 0 ? (activeTickets.length / totalSeats) * 100 : 0;
    const cancelRate = tickets.length > 0 ? (cancelledTickets.length / tickets.length) * 100 : 0;
    const averageTicket = activeTickets.length > 0 ? activeRevenue / activeTickets.length : 0;

    const routeStats = new Map<string, { label: string; tickets: number; revenue: number; cancelled: number }>();
    trips.forEach((trip) => {
      routeStats.set(trip.id, {
        label: `${trip.origin} -> ${trip.destination}`,
        tickets: 0,
        revenue: 0,
        cancelled: 0,
      });
    });

    tickets.forEach((ticket) => {
      const target = routeStats.get(ticket.tripId);
      if (!target) return;
      if (ticket.status === 'cancelled') {
        target.cancelled += 1;
        return;
      }
      target.tickets += 1;
      target.revenue += ticket.price;
    });

    const topRoutes = Array.from(routeStats.values())
      .filter((route) => route.tickets > 0 || route.cancelled > 0)
      .sort((left, right) => right.revenue - left.revenue || right.tickets - left.tickets)
      .slice(0, 5);

    const dailyRevenue = Array.from({ length: 7 }, (_, index) => {
      const day = addDays(todayStart, index - 6);
      const nextDay = addDays(day, 1);
      const dayTickets = activeTickets.filter((ticket) => isWithinRange(new Date(ticket.soldAt), day, nextDay));
      return {
        label: weekdayFormatter.format(day).replace('.', ''),
        revenue: dayTickets.reduce((sum, ticket) => sum + ticket.price, 0),
        tickets: dayTickets.length,
      };
    });

    const monthlyRevenue = Array.from({ length: 6 }, (_, index) => {
      const start = addMonths(monthStart, index - 5);
      const end = addMonths(start, 1);
      const monthTickets = activeTickets.filter((ticket) => isWithinRange(new Date(ticket.soldAt), start, end));
      return {
        label: monthFormatter.format(start).replace('.', '').toUpperCase(),
        revenue: monthTickets.reduce((sum, ticket) => sum + ticket.price, 0),
        tickets: monthTickets.length,
      };
    });

    const peakDailyRevenue = Math.max(...dailyRevenue.map((item) => item.revenue), 1);
    const peakMonthlyRevenue = Math.max(...monthlyRevenue.map((item) => item.revenue), 1);

    return {
      activeRevenue,
      lostRevenue,
      grossRevenue,
      activeTickets,
      cancelledTickets,
      soldToday,
      soldWeek,
      soldMonth,
      soldYear,
      tripsToday,
      tripsWeek,
      tripsMonth,
      tripsYear,
      occupancyRate,
      cancelRate,
      averageTicket,
      topRoutes,
      dailyRevenue,
      monthlyRevenue,
      peakDailyRevenue,
      peakMonthlyRevenue,
    };
  }, [tickets, trips]);

  const expenseMetrics = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const nextMonthStart = addMonths(monthStart, 1);
    const yearStart = startOfYear(now);
    const nextYearStart = new Date(now.getFullYear() + 1, 0, 1);

    const currentMonthExpenses = expenses.filter((expense) => isWithinRange(new Date(expense.expenseDate), monthStart, nextMonthStart));
    const currentYearExpenses = expenses.filter((expense) => isWithinRange(new Date(expense.expenseDate), yearStart, nextYearStart));

    const totalMonth = currentMonthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const totalYear = currentYearExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const fixedMonth = currentMonthExpenses.filter((expense) => expense.category === 'fixed').reduce((sum, expense) => sum + expense.amount, 0);
    const variableMonth = currentMonthExpenses.filter((expense) => expense.category === 'variable').reduce((sum, expense) => sum + expense.amount, 0);
    const payrollMonth = currentMonthExpenses.filter((expense) => expense.category === 'payroll').reduce((sum, expense) => sum + expense.amount, 0);
    const currentMonthRevenue = dashboardMetrics.soldMonth.reduce((sum, ticket) => sum + ticket.price, 0);
    const estimatedUtility = currentMonthRevenue - totalMonth;

    const monthlyExpenses = Array.from({ length: 6 }, (_, index) => {
      const start = addMonths(monthStart, index - 5);
      const end = addMonths(start, 1);
      const periodExpenses = expenses.filter((expense) => isWithinRange(new Date(expense.expenseDate), start, end));
      return {
        label: monthFormatter.format(start).replace('.', '').toUpperCase(),
        amount: periodExpenses.reduce((sum, expense) => sum + expense.amount, 0),
        count: periodExpenses.length,
      };
    });

    return {
      currentMonthExpenses,
      totalMonth,
      totalYear,
      fixedMonth,
      variableMonth,
      payrollMonth,
      currentMonthRevenue,
      estimatedUtility,
      recentExpenses: expenses.slice(0, 8),
      monthlyExpenses,
      peakMonthlyExpenses: Math.max(...monthlyExpenses.map((item) => item.amount), 1),
    };
  }, [dashboardMetrics.soldMonth, expenses]);

  const branchOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; code: string }>();
    operationsContext.forEach((item) => {
      if (!map.has(item.branchId)) {
        map.set(item.branchId, { id: item.branchId, name: item.branchName, code: item.branchCode });
      }
    });
    return Array.from(map.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [operationsContext]);

  const terminalOptions = useMemo(() => {
    return operationsContext
      .filter((item) => selectedBranchId === 'all' || item.branchId === selectedBranchId)
      .map((item) => ({ id: item.terminalId, name: item.terminalName, code: item.terminalCode, branchId: item.branchId }));
  }, [operationsContext, selectedBranchId]);

  const visibleTerminalOptions = useMemo(() => {
    return terminalOptions.filter((item) => selectedBranchId === 'all' || item.branchId === selectedBranchId);
  }, [terminalOptions, selectedBranchId]);

  const branchVisualCards = useMemo(() => {
    return branchOptions.map((branch) => {
      const branchTerminals = operationsContext.filter((item) => item.branchId === branch.id);
      const branchShifts = shiftHistory.filter((shift) => shift.branchId === branch.id);
      const branchOpenShifts = branchShifts.filter((shift) => shift.status === 'open').length;
      const branchClosedShifts = branchShifts.filter((shift) => shift.status === 'closed').length;
      return {
        ...branch,
        terminals: branchTerminals.length,
        openShifts: branchOpenShifts,
        closedShifts: branchClosedShifts,
      };
    });
  }, [branchOptions, operationsContext, shiftHistory]);

  return (
    <section className="grid min-h-[calc(100vh-7.3rem)] grid-cols-1 gap-3 xl:grid-cols-[216px_minmax(0,1fr)] 2xl:grid-cols-[228px_minmax(0,1fr)]">
      <aside className="rounded-2xl border border-black/5 bg-white p-3 shadow-sm xl:sticky xl:top-[5.5rem] xl:max-h-[calc(100vh-6.4rem)] xl:overflow-hidden">
        <p className="mb-2 hidden text-[10px] font-black uppercase tracking-[0.3em] text-[#0f7666] md:block">Panel</p>
        <div className="flex gap-1 overflow-x-auto pb-0.5 md:flex-col md:overflow-x-visible md:pb-0">
          {ADMIN_TABS.map((tab) => (
            <button key={tab.key} onClick={() => setAdminTab(tab.key)} className={`shrink-0 rounded-lg px-3 py-2 text-[11px] font-black uppercase tracking-[0.12em] transition md:mb-1 md:w-full md:text-left ${adminTab === tab.key ? 'bg-[#0f7666] text-white' : 'text-[#334155] hover:bg-[#f1f5f9]'}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-4 hidden text-[11px] text-[#64748b] md:block">Acceso: {isAdminByEmail ? 'Admin verificado' : 'Clave temporal'}</p>
      </aside>

      <div className="rounded-2xl border border-black/5 bg-white p-4 shadow-sm sm:p-5 lg:p-5 xl:min-h-[calc(100vh-6.4rem)] xl:p-6">
        {adminTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Multisucursal</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Vista por sucursal y terminal</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAdminTab('staff')}
                  className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-emerald-700"
                >
                  Gestionar sucursales
                </button>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Sucursal</label>
                  <select
                    value={selectedBranchId}
                    onChange={(event) => setSelectedBranchId(event.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="all">Todas las sucursales</option>
                    {branchOptions.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Terminal</label>
                  <select
                    value={selectedTerminalId}
                    onChange={(event) => setSelectedTerminalId(event.target.value)}
                    className={INPUT_CLASS}
                  >
                    <option value="all">Todas las terminales</option>
                    {visibleTerminalOptions.map((terminal) => (
                      <option key={terminal.id} value={terminal.id}>
                        {terminal.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {branchVisualCards.map((branch) => (
                  <div key={branch.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-500">{branch.code}</p>
                    <p className="mt-1 text-sm font-black text-slate-900">{branch.name}</p>
                    <p className="mt-2 text-xs text-slate-500">{branch.terminals} terminales · {branch.openShifts} turnos abiertos · {branch.closedShifts} cerrados</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 2xl:grid-cols-[1.25fr_0.95fr]">
              <div className="rounded-[1.75rem] border border-emerald-100 bg-[linear-gradient(135deg,#f0fdf4_0%,#ecfeff_100%)] p-5 shadow-[0_18px_40px_rgba(15,118,110,0.08)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#0f7666]">Resumen financiero</p>
                    <h3 className="mt-2 text-3xl font-black tracking-tight text-[#0f172a]">{formatCurrency(dashboardMetrics.activeRevenue)}</h3>
                    <p className="mt-2 max-w-xl text-sm text-slate-600">Ingreso neto confirmado por boletos activos, con seguimiento de venta recuperada, perdida y comportamiento reciente.</p>
                  </div>
                  <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-right shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Ticket promedio</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{formatCurrency(dashboardMetrics.averageTicket)}</p>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700"><Wallet className="h-5 w-5" /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Ingresos activos</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{formatCurrency(totalSales)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-amber-100 p-2 text-amber-700"><AlertTriangle className="h-5 w-5" /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">Ingresos perdidos</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{formatCurrency(dashboardMetrics.lostRevenue)}</p>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-sky-100 p-2 text-sky-700"><ChartColumn className="h-5 w-5" /></div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.14em] text-sky-700">Ingreso bruto</p>
                        <p className="mt-1 text-2xl font-black text-slate-900">{formatCurrency(dashboardMetrics.grossRevenue)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(160deg,#ffffff_0%,#f8fafc_100%)] p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">Salud operativa</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-[#eff6ff] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#1d4ed8]">Ocupacion</p>
                    <p className="mt-2 text-3xl font-black text-[#1e3a8a]">{dashboardMetrics.occupancyRate.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-2xl bg-[#fff7ed] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#c2410c]">Cancelacion</p>
                    <p className="mt-2 text-3xl font-black text-[#9a3412]">{dashboardMetrics.cancelRate.toFixed(1)}%</p>
                  </div>
                  <div className="rounded-2xl bg-[#f0fdf4] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#166534]">Boletos activos</p>
                    <p className="mt-2 text-3xl font-black text-[#14532d]">{formatCompactNumber(dashboardMetrics.activeTickets.length)}</p>
                  </div>
                  <div className="rounded-2xl bg-[#fef2f2] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#b91c1c]">Boletos cancelados</p>
                    <p className="mt-2 text-3xl font-black text-[#991b1b]">{formatCompactNumber(dashboardMetrics.cancelledTickets.length)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700"><CalendarDays className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Hoy</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{formatCurrency(dashboardMetrics.soldToday.reduce((sum, item) => sum + item.price, 0))}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">{dashboardMetrics.soldToday.length} boletos vendidos y {dashboardMetrics.tripsToday.length} corridas programadas.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-sky-100 p-2 text-sky-700"><TicketIcon className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Semana</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{formatCompactNumber(dashboardMetrics.soldWeek.length)}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">{formatCurrency(dashboardMetrics.soldWeek.reduce((sum, item) => sum + item.price, 0))} en ventas y {dashboardMetrics.tripsWeek.length} corridas.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-violet-100 p-2 text-violet-700"><ChartColumn className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Mes</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{formatCurrency(dashboardMetrics.soldMonth.reduce((sum, item) => sum + item.price, 0))}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">{dashboardMetrics.soldMonth.length} boletos confirmados y {dashboardMetrics.tripsMonth.length} corridas del mes.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="rounded-2xl bg-amber-100 p-2 text-amber-700"><BusFront className="h-5 w-5" /></div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Ano</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{dashboardMetrics.tripsYear.length}</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">{dashboardMetrics.soldYear.length} boletos vendidos y {formatCurrency(dashboardMetrics.soldYear.reduce((sum, item) => sum + item.price, 0))} acumulados.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Caja por turno</p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Apertura, cierre y diferencia real</h3>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${currentShift ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {currentShift ? 'Turno abierto' : 'Sin turno activo'}
                  </span>
                </div>

                {currentShift ? (
                  <div className="mt-4 space-y-3">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Apertura</p>
                        <p className="mt-1 text-xl font-black text-slate-900">{formatCurrency(currentShift.openingCash)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Esperado</p>
                        <p className="mt-1 text-xl font-black text-slate-900">{formatCurrency(currentShift.expectedCash)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">Empleado</p>
                        <p className="mt-1 text-sm font-black text-slate-900">{currentShift.userEmail}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                      <div className="space-y-2">
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={shiftClosingCash}
                          onChange={(event) => setShiftClosingCash(Number.parseFloat(event.target.value || '0'))}
                          className={INPUT_CLASS}
                          placeholder="Efectivo real al cierre"
                        />
                        <textarea
                          value={shiftClosingNote}
                          onChange={(event) => setShiftClosingNote(event.target.value)}
                          className={`${INPUT_CLASS} min-h-20 resize-y`}
                          placeholder="Observacion para el siguiente turno o admin"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          requestConfirmation({
                            title: 'Cerrar turno',
                            message: `Se cerrara el turno con efectivo reportado de ${formatCurrency(shiftClosingCash)}.`,
                            actionLabel: 'Cerrar turno',
                            onConfirm: closeShift,
                          })
                        }
                        className={`${BTN_PRIMARY} justify-center px-5 py-3`}
                      >
                        Cerrar turno
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={shiftOpeningCash}
                      onChange={(event) => setShiftOpeningCash(Number.parseFloat(event.target.value || '0'))}
                      className={INPUT_CLASS}
                      placeholder="Monto de apertura"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        requestConfirmation({
                          title: 'Abrir turno',
                          message: `Se abrira turno con caja inicial de ${formatCurrency(shiftOpeningCash)}.`,
                          actionLabel: 'Abrir turno',
                          onConfirm: openShift,
                        })
                      }
                      className={`${BTN_PRIMARY} justify-center px-5 py-3`}
                    >
                      Abrir turno
                    </button>
                  </div>
                )}

                <div className="mt-4 text-xs text-slate-500">
                  {currentShift
                    ? `Sucursal: ${currentShift.branchName} · Terminal: ${currentShift.terminalName} · Apertura: ${formatDateTime(currentShift.openedAt)}`
                    : 'Abre turno para registrar corte de caja por empleado.'}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Utilidad neta mensual</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-emerald-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">Ingresos</p>
                    <p className="mt-1 text-lg font-black text-emerald-900">{formatCurrency(operationsKpi?.revenueMonth ?? 0)}</p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">Descuentos</p>
                    <p className="mt-1 text-lg font-black text-amber-900">{formatCurrency(operationsKpi?.discountsMonth ?? 0)}</p>
                  </div>
                  <div className="rounded-xl bg-rose-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-rose-700">Cancelaciones</p>
                    <p className="mt-1 text-lg font-black text-rose-900">{formatCurrency(operationsKpi?.cancelLossMonth ?? 0)}</p>
                  </div>
                  <div className="rounded-xl bg-sky-50 p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-sky-700">Gastos</p>
                    <p className="mt-1 text-lg font-black text-sky-900">{formatCurrency(operationsKpi?.expensesMonth ?? 0)}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-700">Utilidad neta</p>
                  <p className="mt-1 text-2xl font-black text-emerald-900">{formatCurrency(operationsKpi?.netUtilityMonth ?? 0)}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Cortes recientes</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Turnos y diferencias por empleado</h3>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {shiftHistory.length > 0 ? (
                  shiftHistory.map((shift) => (
                    <div key={shift.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-black text-slate-900">{shift.userEmail}</p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${shift.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-700'}`}>
                          {shift.status === 'open' ? 'Abierto' : 'Cerrado'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{shift.branchName} · {shift.terminalName}</p>
                      {shift.openingNote && <p className="mt-1 text-xs text-slate-600">Inicio: {shift.openingNote}</p>}
                      {shift.closingNote && <p className="mt-1 text-xs text-amber-700">Entrega: {shift.closingNote}</p>}
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                        <div><span className="font-black text-slate-500">Apertura:</span> {formatCurrency(shift.openingCash)}</div>
                        <div><span className="font-black text-slate-500">Esperado:</span> {formatCurrency(shift.expectedCash)}</div>
                        <div><span className="font-black text-slate-500">Cierre:</span> {formatCurrency(shift.closingCash ?? 0)}</div>
                        <div><span className="font-black text-slate-500">Diferencia:</span> {formatCurrency(shift.difference ?? 0)}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                    Aun no hay turnos registrados.
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Ventas por dia</p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Ultimos 7 dias</h3>
                  </div>
                  <p className="text-xs text-slate-500">Seguimiento diario de ingresos y boletos</p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
                  {dashboardMetrics.dailyRevenue.map((item) => (
                    <div key={item.label} className="flex flex-col items-center gap-2">
                      <div className="flex h-40 w-full items-end rounded-2xl bg-slate-50 px-2 py-2">
                        <div
                          className="w-full rounded-xl bg-[linear-gradient(180deg,#34d399_0%,#0f7666_100%)]"
                          style={{ height: `${Math.max((item.revenue / dashboardMetrics.peakDailyRevenue) * 100, item.revenue > 0 ? 12 : 4)}%` }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{item.label}</p>
                        <p className="mt-1 text-sm font-bold text-slate-900">{formatCurrency(item.revenue)}</p>
                        <p className="text-[11px] text-slate-500">{item.tickets} boletos</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Registro general</p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Ganado este mes</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{formatCurrency(dashboardMetrics.soldMonth.reduce((sum, item) => sum + item.price, 0))}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Perdido por cancelaciones</p>
                    <p className="mt-1 text-2xl font-black text-[#b45309]">{formatCurrency(dashboardMetrics.lostRevenue)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Corridas del mes</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{formatCompactNumber(dashboardMetrics.tripsMonth.length)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Boletos del ano</p>
                    <p className="mt-1 text-2xl font-black text-slate-900">{formatCompactNumber(dashboardMetrics.soldYear.length)}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Ventas por mes</p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Ultimos 6 meses</h3>
                  </div>
                  <p className="text-xs text-slate-500">Tendencia acumulada</p>
                </div>
                <div className="mt-5 space-y-3">
                  {dashboardMetrics.monthlyRevenue.map((item) => (
                    <div key={item.label}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-black uppercase tracking-[0.14em] text-slate-500">{item.label}</span>
                        <span className="font-bold text-slate-800">{formatCurrency(item.revenue)} · {item.tickets} boletos</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[linear-gradient(90deg,#0f7666_0%,#34d399_100%)]"
                          style={{ width: `${Math.max((item.revenue / dashboardMetrics.peakMonthlyRevenue) * 100, item.revenue > 0 ? 8 : 3)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Rutas destacadas</p>
                    <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Lo que mas vende</h3>
                  </div>
                  <p className="text-xs text-slate-500">Basado en ingresos y boletos</p>
                </div>
                <div className="mt-5 space-y-3">
                  {dashboardMetrics.topRoutes.length > 0 ? (
                    dashboardMetrics.topRoutes.map((route, index) => (
                      <div key={`${route.label}-${index}`} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-slate-900">{route.label}</p>
                            <p className="mt-1 text-xs text-slate-500">{route.tickets} boletos activos · {route.cancelled} cancelados</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-[#0f7666]">{formatCurrency(route.revenue)}</p>
                            <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Top {index + 1}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                      Aun no hay suficientes ventas para construir ranking de rutas.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {adminTab === 'create' && (
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[1.2fr_minmax(0,1fr)]">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                requestConfirmation({
                  title: 'Crear corrida',
                  message: `Se creara la unidad #${newTrip.routeId || '-'} para ${newTrip.origin || '-'} -> ${newTrip.destination || '-'}.`,
                  actionLabel: 'Confirmar creacion',
                  onConfirm: createTrip,
                });
              }}
              className="grid grid-cols-1 gap-3 lg:grid-cols-2"
            >
              <div className="md:col-span-2">
                <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">Ruta existente (opcional)</label>
                <select
                  value={routeMap.has(selectedRouteKey) ? selectedRouteKey : ''}
                  onChange={(event) => {
                    const selected = routeMap.get(event.target.value);
                    if (!selected) return;
                    setNewTrip({
                      ...newTrip,
                      origin: selected.origin,
                      destination: selected.destination,
                      price: selected.price,
                    });
                  }}
                  className={INPUT_CLASS}
                >
                  <option value="">Seleccion manual</option>
                  {routeOptions.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.origin} {'->'} {option.destination}
                    </option>
                  ))}
                </select>
              </div>
              <input required value={newTrip.routeId} onChange={(event) => setNewTrip({ ...newTrip, routeId: event.target.value })} className={INPUT_CLASS} placeholder="Numero de unidad" />
              <input required type="number" value={newTrip.price} onChange={(event) => setNewTrip({ ...newTrip, price: Number.parseInt(event.target.value || '0', 10) })} className={INPUT_CLASS} placeholder="Precio" />
              <div>
                <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">Tipo de unidad</label>
                <select
                  value={newTrip.vehicleType}
                  onChange={(event) => {
                    const selectedVehicle = VEHICLE_TYPE_OPTIONS.find((option) => option.value === event.target.value);
                    setNewTrip({
                      ...newTrip,
                      vehicleType: (selectedVehicle?.value ?? 'autobus') as VehicleType,
                      seatCount: selectedVehicle?.seatCount ?? newTrip.seatCount,
                    });
                  }}
                  className={INPUT_CLASS}
                >
                  {VEHICLE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label} ({option.seatCount} asientos)
                    </option>
                  ))}
                </select>
              </div>
              <input required type="number" min={4} max={80} value={newTrip.seatCount} onChange={(event) => setNewTrip({ ...newTrip, seatCount: Number.parseInt(event.target.value || '40', 10) })} className={INPUT_CLASS} placeholder="Asientos (ej. 40)" title="Numero de asientos de la unidad (4–80)" />
              <input list="origin-options" required value={newTrip.origin} onChange={(event) => setNewTrip({ ...newTrip, origin: event.target.value })} className={INPUT_CLASS} placeholder="Origen" />
              <input list="destination-options" required value={newTrip.destination} onChange={(event) => setNewTrip({ ...newTrip, destination: event.target.value })} className={INPUT_CLASS} placeholder="Destino" />
              <label className="md:col-span-2 inline-flex items-center gap-2 rounded-xl border border-black/10 bg-[#f8fafc] px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-[#334155]">
                <input
                  type="checkbox"
                  checked={newTrip.requiresPassengerName}
                  onChange={(event) => setNewTrip({ ...newTrip, requiresPassengerName: event.target.checked })}
                />
                Requerir nombre del pasajero en esta corrida
              </label>
              <input required type="datetime-local" value={newTrip.departureTime} onChange={(event) => setNewTrip({ ...newTrip, departureTime: event.target.value })} className={`${INPUT_CLASS} md:col-span-2`} />
              <datalist id="origin-options">
                {originOptions.map((origin) => (
                  <option key={origin} value={origin} />
                ))}
              </datalist>
              <datalist id="destination-options">
                {destinationOptions.map((destination) => (
                  <option key={destination} value={destination} />
                ))}
              </datalist>
              <button type="submit" className={`${BTN_PRIMARY} py-3 md:col-span-2`}><Plus className="h-4 w-4" /><span>Crear corrida</span></button>
            </form>

            <div className="rounded-2xl border border-black/10 bg-[#f8fafc] p-3 lg:p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#0f7666]">Mapa de ruta</p>
              <p className="mt-1 text-sm font-black text-[#0f172a]">{newTrip.origin || 'Origen'} {'->'} {newTrip.destination || 'Destino'}</p>
              <div className="mt-3 overflow-hidden rounded-xl border border-black/10 bg-white">
                <MapContainer
                  center={mapCenter}
                  zoom={8}
                  scrollWheelZoom
                  className="h-52 w-full sm:h-60 lg:h-64"
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {originPoint && (
                    <Marker position={[originPoint.lat, originPoint.lon]} icon={markerIcon}>
                      <Popup>Origen: {newTrip.origin}</Popup>
                    </Marker>
                  )}
                  {destinationPoint && (
                    <Marker position={[destinationPoint.lat, destinationPoint.lon]} icon={markerIcon}>
                      <Popup>Destino: {newTrip.destination}</Popup>
                    </Marker>
                  )}
                  {routeLine.length > 0 && <Polyline positions={routeLine} pathOptions={{ color: '#0f7666', weight: 5 }} />}
                </MapContainer>
              </div>
              {mapLoading && <p className="mt-2 text-xs font-semibold text-[#0f7666]">Calculando ruta real...</p>}
              {mapError && <p className="mt-2 text-xs font-semibold text-[#b91c1c]">{mapError}</p>}
              <p className="mt-2 text-xs text-[#475569]">Unidad seleccionada: <span className="font-black text-[#0f172a]">{getVehicleTypeLabel(newTrip.vehicleType)}</span></p>
              <p className="mt-2 text-xs text-[#475569]">Tarifa actual: <span className="font-black text-[#0f172a]">${newTrip.price}</span></p>
              <div className="mt-3 rounded-xl border border-black/10 bg-white p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">Rutas activas</p>
                {routePairs.length === 0 ? (
                  <p className="mt-2 text-xs text-[#64748b]">Todavia no hay rutas creadas.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {routePairs.map((pair) => (
                      <span key={pair} className="rounded-full border border-black/10 bg-[#f8fafc] px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#334155]">
                        {pair}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {adminTab === 'trips' && (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-1">
            {trips.map((trip) => {
              const sold = Object.values(trip.seats as Record<string, SeatInfo>).filter((seat) => seat.status === 'sold').length;
              return (
                <div key={trip.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 p-3">
                  <div>
                    <p className="text-lg font-black">#{trip.routeId}</p>
                    <p className="text-xs uppercase tracking-[0.12em] text-[#64748b]">{trip.origin} {'->'} {trip.destination}</p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.1em] text-[#0f7666]">{getVehicleTypeLabel(trip.vehicleType)}</p>
                  </div>
                  <div className="text-sm font-black text-[#334155]">{sold}/{trip.seatCount}</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        requestConfirmation({
                          title: 'Reiniciar unidad',
                          message: `Se liberaran todos los asientos de la unidad #${trip.routeId}.`,
                          actionLabel: 'Reiniciar',
                          onConfirm: () => handleResetTrip(trip.id, trip.routeId),
                        })
                      }
                      className="rounded-lg border border-black/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#0f7666]"
                    >
                      Reiniciar
                    </button>
                    <button
                      onClick={() =>
                        requestConfirmation({
                          title: 'Eliminar corrida',
                          message: `Se eliminara definitivamente la unidad #${trip.routeId}. Esta accion no se puede deshacer.`,
                          actionLabel: 'Eliminar',
                          actionTone: 'danger',
                          onConfirm: () => handleDeleteTrip(trip.id, trip.routeId),
                        })
                      }
                      className="rounded-lg border border-black/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#b91c1c]"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {adminTab === 'sales' && (
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 2xl:grid-cols-1">
            {tickets.map((ticket) => (
              <div key={ticket.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${ticket.status === 'cancelled' ? 'border-[#fecaca] bg-[#fff1f2]' : 'border-black/10 bg-white'}`}>
                <div><p className="text-sm font-black uppercase">{ticket.passengerName}</p><p className="text-xs text-[#64748b]">Asiento {ticket.seatNumber.toString().padStart(2, '0')} | ${ticket.price}</p></div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setLastSoldTicket(ticket); setShowTicketModal(true); }} className="rounded-lg border border-black/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#1d4ed8]">Reimprimir</button>
                  {ticket.status !== 'cancelled' && (
                    <button onClick={() => handleCancelTicket(ticket)} className="rounded-lg border border-black/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#b91c1c]">Cancelar</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {adminTab === 'expenses' && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[0.95fr_1.05fr]">
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  requestConfirmation({
                    title: 'Registrar gasto',
                    message: `Se registrara ${newExpense.title || 'un gasto'} por ${formatCurrency(newExpense.amount || 0)} en la categoria ${EXPENSE_CATEGORY_LABEL[newExpense.category].toLowerCase()}.`,
                    actionLabel: 'Guardar gasto',
                    onConfirm: createExpense,
                  });
                }}
                className="rounded-[1.75rem] border border-slate-200 bg-[linear-gradient(160deg,#ffffff_0%,#f8fafc_100%)] p-4 shadow-sm sm:p-5"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0f7666]">Registro de gastos</p>
                <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">Captura gasto fijo, variable o nomina</h3>
                <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Categoria</label>
                    <select
                      value={newExpense.category}
                      onChange={(event) => setNewExpense({ ...newExpense, category: event.target.value as ExpenseCategory })}
                      className={INPUT_CLASS}
                    >
                      <option value="fixed">Gasto fijo</option>
                      <option value="variable">Gasto variable</option>
                      <option value="payroll">Pago de trabajador</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Metodo de pago</label>
                    <select
                      value={newExpense.paymentMethod}
                      onChange={(event) => setNewExpense({ ...newExpense, paymentMethod: event.target.value as 'cash' | 'transfer' | 'card' | 'other' })}
                      className={INPUT_CLASS}
                    >
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                      <option value="card">Tarjeta</option>
                      <option value="other">Otro</option>
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Concepto</label>
                    <input
                      value={newExpense.title}
                      onChange={(event) => setNewExpense({ ...newExpense, title: event.target.value })}
                      className={INPUT_CLASS}
                      placeholder="Ej. Sueldo chofer, combustible, renta, mantenimiento"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Monto</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={newExpense.amount}
                      onChange={(event) => setNewExpense({ ...newExpense, amount: Number.parseFloat(event.target.value || '0') })}
                      className={INPUT_CLASS}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Fecha y hora</label>
                    <input
                      type="datetime-local"
                      value={newExpense.expenseDate}
                      onChange={(event) => setNewExpense({ ...newExpense, expenseDate: event.target.value })}
                      className={INPUT_CLASS}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Descripcion</label>
                    <input
                      value={newExpense.description}
                      onChange={(event) => setNewExpense({ ...newExpense, description: event.target.value })}
                      className={INPUT_CLASS}
                      placeholder="Proveedor, trabajador o detalle corto"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Notas</label>
                    <textarea
                      value={newExpense.notes}
                      onChange={(event) => setNewExpense({ ...newExpense, notes: event.target.value })}
                      className={`${INPUT_CLASS} min-h-28 resize-y`}
                      placeholder="Observaciones internas del gasto"
                    />
                  </div>
                </div>
                <button type="submit" className={`${BTN_PRIMARY} mt-4 w-full py-3`}>
                  <Plus className="h-4 w-4" />
                  <span>Registrar gasto</span>
                </button>
              </form>

              <div className="space-y-4">
                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Control del mes</p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-[#fef2f2] p-4">
                      <div className="flex items-center gap-2 text-[#b91c1c]"><Receipt className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.14em]">Gasto mensual</span></div>
                      <p className="mt-2 text-3xl font-black text-[#991b1b]">{formatCurrency(expenseMetrics.totalMonth)}</p>
                    </div>
                    <div className="rounded-2xl bg-[#ecfdf5] p-4">
                      <div className="flex items-center gap-2 text-[#166534]"><Wallet className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.14em]">Utilidad estimada</span></div>
                      <p className="mt-2 text-3xl font-black text-[#14532d]">{formatCurrency(expenseMetrics.estimatedUtility)}</p>
                    </div>
                    <div className="rounded-2xl bg-[#eff6ff] p-4">
                      <div className="flex items-center gap-2 text-[#1d4ed8]"><Landmark className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.14em]">Fijos</span></div>
                      <p className="mt-2 text-3xl font-black text-[#1e3a8a]">{formatCurrency(expenseMetrics.fixedMonth)}</p>
                    </div>
                    <div className="rounded-2xl bg-[#fff7ed] p-4">
                      <div className="flex items-center gap-2 text-[#c2410c]"><CreditCard className="h-4 w-4" /><span className="text-[10px] font-black uppercase tracking-[0.14em]">Variables</span></div>
                      <p className="mt-2 text-3xl font-black text-[#9a3412]">{formatCurrency(expenseMetrics.variableMonth)}</p>
                    </div>
                    <div className="col-span-2 rounded-2xl bg-[#f0fdf4] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#166534]">Pagos a trabajadores</p>
                      <p className="mt-2 text-3xl font-black text-[#14532d]">{formatCurrency(expenseMetrics.payrollMonth)}</p>
                      <p className="mt-2 text-xs text-slate-500">Total anual gastado: {formatCurrency(expenseMetrics.totalYear)}. Ingreso del mes: {formatCurrency(expenseMetrics.currentMonthRevenue)}.</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Tendencia de gasto</p>
                      <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Ultimos 6 meses</h3>
                    </div>
                    <p className="text-xs text-slate-500">{expenseMetrics.currentMonthExpenses.length} registros en el mes</p>
                  </div>
                  <div className="mt-5 space-y-3">
                    {expenseMetrics.monthlyExpenses.map((item) => (
                      <div key={item.label}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-black uppercase tracking-[0.12em] text-slate-500">{item.label}</span>
                          <span className="font-bold text-slate-800">{formatCurrency(item.amount)} · {item.count} gastos</span>
                        </div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-[linear-gradient(90deg,#f59e0b_0%,#dc2626_100%)]"
                            style={{ width: `${Math.max((item.amount / expenseMetrics.peakMonthlyExpenses) * 100, item.amount > 0 ? 8 : 3)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Registro de movimientos</p>
                  <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Gastos recientes</h3>
                </div>
                <p className="text-xs text-slate-500">Control de egresos fijos, variables y pagos</p>
              </div>
              <div className="mt-5 space-y-3">
                {expenseMetrics.recentExpenses.length > 0 ? (
                  expenseMetrics.recentExpenses.map((expense) => (
                    <div key={expense.id} className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-black text-slate-900">{expense.title}</p>
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${EXPENSE_CATEGORY_TONE[expense.category]}`}>
                            {EXPENSE_CATEGORY_LABEL[expense.category]}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(expense.expenseDate)} · {PAYMENT_METHOD_LABEL[expense.paymentMethod]} · {expense.createdByEmail || 'admin'}</p>
                        {expense.description && <p className="mt-2 text-sm text-slate-700">{expense.description}</p>}
                        {expense.notes && <p className="mt-1 text-xs text-slate-500">Nota: {expense.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-lg font-black text-[#b91c1c]">{formatCurrency(expense.amount)}</p>
                          <p className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Egreso</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            requestConfirmation({
                              title: 'Eliminar gasto',
                              message: `Se eliminara el gasto ${expense.title} por ${formatCurrency(expense.amount)}.`,
                              actionLabel: 'Eliminar',
                              actionTone: 'danger',
                              onConfirm: () => deleteExpense(expense.id),
                            })
                          }
                          className="rounded-xl border border-red-200 px-3 py-2 text-red-600 transition hover:bg-red-50"
                          aria-label={`Eliminar gasto ${expense.title}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
                    Aun no hay gastos registrados. Empieza capturando renta, sueldos, mantenimiento o combustible.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {adminTab === 'staff' && (
          <StaffManagementPanel
            selectedBranchId={selectedBranchId}
            setSelectedBranchId={setSelectedBranchId}
            selectedTerminalId={selectedTerminalId}
            setSelectedTerminalId={setSelectedTerminalId}
            operationsContext={operationsContext}
            employeeUsers={employeeUsers}
            employeeSchedules={employeeSchedules}
            newEmployee={newEmployee}
            setNewEmployee={setNewEmployee}
            createEmployee={createEmployee}
            toggleEmployeeStatus={toggleEmployeeStatus}
            newSchedule={newSchedule}
            setNewSchedule={setNewSchedule}
            createEmployeeSchedule={createEmployeeSchedule}
            deleteEmployeeSchedule={deleteEmployeeSchedule}
            newBranch={newBranch}
            setNewBranch={setNewBranch}
            createBranch={createBranch}
            newTerminal={newTerminal}
            setNewTerminal={setNewTerminal}
            createTerminal={createTerminal}
            vehicles={vehicles}
            newVehicle={newVehicle}
            setNewVehicle={setNewVehicle}
            createVehicle={createVehicle}
            updateVehicleStatus={updateVehicleStatus}
            requestConfirmation={requestConfirmation}
          />
        )}

        {adminTab === 'branding' && (
          <div className="grid grid-cols-1 gap-4 2xl:grid-cols-2">
            <div className="space-y-3">
              <label className="text-xs font-black uppercase tracking-[0.15em] text-[#64748b]">Nombre de empresa</label>
              <input value={brandingDraft.companyName} onChange={(event) => setBrandingDraft({ ...brandingDraft, companyName: event.target.value })} className={INPUT_CLASS} />
              <label className="text-xs font-black uppercase tracking-[0.15em] text-[#64748b]">Logo (URL o archivo)</label>
              <input value={brandingDraft.logoUrl} onChange={(event) => setBrandingDraft({ ...brandingDraft, logoUrl: event.target.value })} className={INPUT_CLASS} placeholder="https://..." />
              <input type="file" accept="image/*" onChange={handleLogoFileChange} className={`${INPUT_CLASS} py-2`} />

              <label className="text-xs font-black uppercase tracking-[0.15em] text-[#64748b]">Imagenes hero (maximo 4)</label>
              <div className="flex gap-2">
                <input
                  value={heroUrlInput}
                  onChange={(event) => setHeroUrlInput(event.target.value)}
                  className={INPUT_CLASS}
                  placeholder="https://..."
                />
                <button
                  type="button"
                  onClick={addHeroUrl}
                  disabled={safeHeroImages.length >= 4}
                  className="rounded-xl border border-black/10 px-3 text-xs font-black uppercase tracking-[0.1em] text-[#334155] disabled:opacity-50"
                >
                  Agregar
                </button>
              </div>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleHeroFilesChange}
                disabled={safeHeroImages.length >= 4}
                className={`${INPUT_CLASS} py-2 disabled:opacity-50`}
              />
              <div className="grid grid-cols-2 gap-2">
                {safeHeroImages.map((image, index) => (
                  <div key={`${image.slice(0, 24)}-${index}`} className="overflow-hidden rounded-xl border border-black/10 bg-white">
                    <img src={image} alt={`Hero ${index + 1}`} className="h-24 w-full object-cover" />
                    <div className="flex gap-1 p-2">
                      <button
                        type="button"
                        onClick={() => setAsPrimaryHero(index)}
                        className="flex-1 rounded-md border border-black/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#0f7666]"
                      >
                        Principal
                      </button>
                      <button
                        type="button"
                        onClick={() => removeHeroImage(index)}
                        className="rounded-md border border-black/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#b91c1c]"
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              {safeHeroImages.length === 0 && <p className="text-xs text-[#64748b]">Aun no agregas imagenes hero.</p>}
              <label className="text-xs font-black uppercase tracking-[0.15em] text-[#64748b]">Tagline</label>
              <input value={brandingDraft.tagline} onChange={(event) => setBrandingDraft({ ...brandingDraft, tagline: event.target.value })} className={INPUT_CLASS} />
              <button
                onClick={() =>
                  requestConfirmation({
                    title: 'Guardar branding',
                    message: 'Se aplicaran los cambios visuales de marca para todo el sistema.',
                    actionLabel: 'Guardar branding',
                    onConfirm: saveBranding,
                  })
                }
                className={`${BTN_PRIMARY} w-full py-3`}
              >
                Guardar branding
              </button>

              <div className="mt-4 rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[#0f7666]">Descuentos por edad</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="col-span-2 rounded-xl border border-black/10 bg-white p-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">Tipos visibles en venta</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs font-black uppercase tracking-[0.08em] text-[#334155]">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={discountConfig.childEnabled}
                          onChange={(event) => setDiscountConfig({ ...discountConfig, childEnabled: event.target.checked })}
                        />
                        Nino
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={discountConfig.seniorEnabled}
                          onChange={(event) => setDiscountConfig({ ...discountConfig, seniorEnabled: event.target.checked })}
                        />
                        Adulto mayor
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={discountConfig.disabilityEnabled}
                          onChange={(event) => setDiscountConfig({ ...discountConfig, disabilityEnabled: event.target.checked })}
                        />
                        Discapacidad
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">Nino hasta edad</label>
                    <input
                      type="number"
                      min={0}
                      max={17}
                      value={discountConfig.childMaxAge}
                      onChange={(event) =>
                        setDiscountConfig({ ...discountConfig, childMaxAge: Number.parseInt(event.target.value || '0', 10) })
                      }
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">Desc. nino %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={discountConfig.childPercent}
                      onChange={(event) =>
                        setDiscountConfig({ ...discountConfig, childPercent: Number.parseInt(event.target.value || '0', 10) })
                      }
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">Adulto mayor desde</label>
                    <input
                      type="number"
                      min={50}
                      max={120}
                      value={discountConfig.seniorMinAge}
                      onChange={(event) =>
                        setDiscountConfig({ ...discountConfig, seniorMinAge: Number.parseInt(event.target.value || '50', 10) })
                      }
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">Desc. mayor %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={discountConfig.seniorPercent}
                      onChange={(event) =>
                        setDiscountConfig({ ...discountConfig, seniorPercent: Number.parseInt(event.target.value || '0', 10) })
                      }
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">Desc. discapacidad %</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={discountConfig.disabilityPercent}
                      onChange={(event) =>
                        setDiscountConfig({ ...discountConfig, disabilityPercent: Number.parseInt(event.target.value || '0', 10) })
                      }
                      className={`${INPUT_CLASS} mt-1`}
                    />
                  </div>
                </div>
                <button
                  onClick={() =>
                    requestConfirmation({
                      title: 'Guardar descuentos',
                      message: 'Se actualizaran las reglas de descuento por edad para nuevas ventas.',
                      actionLabel: 'Guardar descuentos',
                      onConfirm: saveDiscountConfig,
                    })
                  }
                  disabled={discountConfigSaving}
                  className={`${BTN_PRIMARY} mt-3 w-full py-3 disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {discountConfigSaving ? 'Guardando...' : 'Guardar descuentos'}
                </button>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
              <img src={previewHeroImage} alt="Preview" className="h-56 w-full object-cover" />
              <div className="p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-[#0f7666]">Preview</p>
                <p className="mt-2 text-2xl font-black">{brandingDraft.companyName}</p>
                <p className="mt-1 text-sm text-[#475569]">{brandingDraft.tagline}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {confirmModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => setConfirmModal(null)}
            className="absolute inset-0 bg-black/55"
            aria-label="Cerrar confirmacion"
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-black/10 bg-white p-5 shadow-2xl">
            <p className="text-lg font-black tracking-tight text-[#0f172a]">{confirmModal.title}</p>
            <p className="mt-2 text-sm text-[#475569]">{confirmModal.message}</p>
            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[#334155]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  confirmModal.onConfirm();
                  setConfirmModal(null);
                }}
                className={`flex-1 rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-white ${
                  confirmModal.actionTone === 'danger' ? 'bg-[#dc2626]' : 'bg-[#0f7666]'
                }`}
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
