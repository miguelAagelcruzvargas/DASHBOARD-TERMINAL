import React, { useEffect, useMemo, useState } from 'react';
import { Bus } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AppUserRole, CashShift, DiscountConfig, EmployeeSchedule, EmployeeUser, Expense, ExpenseCategory, ExpensePaymentMethod, OperationsContextUnit, OperationsKpi, SeatInfo, Ticket, Trip, TripStatus, VehicleIssueReport, VehicleIssueSeverity, VehicleRecord, VehicleType } from '../types';
import { LoginScreen } from '../components/terminal/LoginScreen';
import { AppHeader } from '../components/terminal/AppHeader';
import { SellerView } from '../components/terminal/SellerView';
import { SalesView } from '../components/terminal/SalesView';
import { DriverView } from '../components/terminal/DriverView';
import { AdminView } from '../components/terminal/AdminView';
import { AdminAccessModal } from '../components/terminal/AdminAccessModal';
import { SaleModal } from '../components/terminal/SaleModal';
import { CancelTicketModal } from '../components/terminal/CancelTicketModal';
import { TicketModal } from '../components/terminal/TicketModal';
import { AdminTab, Branding, DEFAULT_BRANDING, ViewMode } from '../components/terminal/config';
import { DISCOUNT_RULES, FareType } from '../lib/discounts';

type NewTripForm = {
  routeId: string;
  origin: string;
  destination: string;
  requiresPassengerName: boolean;
  vehicleType: VehicleType;
  seatCount: number;
  price: number;
  departureTime: string;
};

type NewExpenseForm = {
  category: ExpenseCategory;
  title: string;
  description: string;
  amount: number;
  expenseDate: string;
  paymentMethod: ExpensePaymentMethod;
  notes: string;
};

type ApiUser = {
  id: number;
  email: string;
  fullName?: string;
  role: AppUserRole;
  branchId: string;
  terminalId: string;
};

type CreatedCredentialRecord = {
  createdAt: string;
  fullName: string;
  role: AppUserRole;
  email: string;
  password: string;
  branchName: string;
  terminalName: string;
};

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
const TOKEN_KEY = 'terminal_au_token';
const ADMIN_ACCESS_SESSION_KEY = 'terminal_admin_access';
const ADMIN_TAB_SESSION_KEY = 'terminal_admin_tab';

function getLocalDateTimeValue() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function TerminalSystemPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [branding, setBranding] = useState<Branding>(() => {
    if (typeof window === 'undefined') return DEFAULT_BRANDING;
    const raw = window.localStorage.getItem('terminal-branding');
    if (!raw) return DEFAULT_BRANDING;
    try {
      const parsed = JSON.parse(raw) as Partial<Branding>;
      return {
        companyName: parsed.companyName || DEFAULT_BRANDING.companyName,
        logoUrl: parsed.logoUrl || DEFAULT_BRANDING.logoUrl,
        heroImageUrl: parsed.heroImageUrl || DEFAULT_BRANDING.heroImageUrl,
        heroImages:
          Array.isArray(parsed.heroImages) && parsed.heroImages.length > 0
            ? parsed.heroImages.slice(0, 4).filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
            : [parsed.heroImageUrl || DEFAULT_BRANDING.heroImageUrl],
        tagline: parsed.tagline || DEFAULT_BRANDING.tagline,
      };
    } catch (_error) {
      return DEFAULT_BRANDING;
    }
  });

  const [brandingDraft, setBrandingDraft] = useState<Branding>(branding);

  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [authUser, setAuthUser] = useState<ApiUser | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(TOKEN_KEY);
  });

  const [credentials, setCredentials] = useState({ email: '', password: '' });
  const [authError, setAuthError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [adminInfoMessage, setAdminInfoMessage] = useState<string | null>(null);
  const [generatedDriverCredentials, setGeneratedDriverCredentials] = useState<{
    fullName: string;
    email: string;
    password: string;
  } | null>(null);
  const [createdCredentialsLog, setCreatedCredentialsLog] = useState<CreatedCredentialRecord[]>([]);

  const [hasAdminAccess, setHasAdminAccess] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(ADMIN_ACCESS_SESSION_KEY) === '1';
  });

  const [view, setView] = useState<ViewMode>('seller');
  const [adminTab, setAdminTab] = useState<AdminTab>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const stored = window.sessionStorage.getItem(ADMIN_TAB_SESSION_KEY);
    return stored === 'dashboard' || stored === 'create' || stored === 'trips' || stored === 'sales' || stored === 'expenses' || stored === 'staff' || stored === 'branding'
      ? stored
      : 'dashboard';
  });

  const [trips, setTrips] = useState<Trip[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [currentShift, setCurrentShift] = useState<CashShift | null>(null);
  const [shiftHistory, setShiftHistory] = useState<CashShift[]>([]);
  const [operationsKpi, setOperationsKpi] = useState<OperationsKpi | null>(null);
  const [operationsContext, setOperationsContext] = useState<OperationsContextUnit[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('all');
  const [selectedTerminalId, setSelectedTerminalId] = useState('all');
  const [employeeUsers, setEmployeeUsers] = useState<EmployeeUser[]>([]);
  const [employeeSchedules, setEmployeeSchedules] = useState<EmployeeSchedule[]>([]);
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [vehicleIssues, setVehicleIssues] = useState<VehicleIssueReport[]>([]);
  const [shiftClosingNote, setShiftClosingNote] = useState('');
  const [shiftOpeningCash, setShiftOpeningCash] = useState(0);
  const [shiftClosingCash, setShiftClosingCash] = useState(0);

  const [newEmployee, setNewEmployee] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'seller' as AppUserRole,
    branchId: '',
    terminalId: '',
  });

  const [newVehicleIssue, setNewVehicleIssue] = useState({
    vehicleId: '',
    severity: 'medium' as VehicleIssueSeverity,
    issueType: '',
    description: '',
  });

  const [newSchedule, setNewSchedule] = useState({
    userId: '',
    branchId: '',
    terminalId: '',
    dayOfWeek: 0,
    startTime: '06:00',
    endTime: '15:00',
    notes: '',
  });

  const [newBranch, setNewBranch] = useState({ code: '', name: '' });
  const [newTerminal, setNewTerminal] = useState({ branchId: '', code: '', name: '' });
  const [newVehicle, setNewVehicle] = useState({
    branchId: '',
    terminalId: '',
    plateNumber: '',
    internalCode: '',
    vehicleType: 'autobus' as VehicleType,
    capacity: 40,
    operationalStatus: 'active' as 'active' | 'maintenance' | 'inactive',
    photoUrl: '',
    notes: '',
    lastInspectionAt: '',
  });

  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<string | null>(null);
  const [lastPurchasedSeat, setLastPurchasedSeat] = useState<string | null>(null);

  const [passengerName, setPassengerName] = useState('');
  const [fareType, setFareType] = useState<FareType>('adult');
  const [searchTerm, setSearchTerm] = useState('');
  const [destinationFilter, setDestinationFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const [showSaleModal, setShowSaleModal] = useState(false);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);

  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState('');

  const [ticketToCancel, setTicketToCancel] = useState<Ticket | null>(null);
  const [lastSoldTicket, setLastSoldTicket] = useState<Ticket | null>(null);

  const [newTrip, setNewTrip] = useState<NewTripForm>({
    routeId: '',
    origin: 'TERMINAL AU',
    destination: '',
    requiresPassengerName: true,
    vehicleType: 'autobus',
    seatCount: 40,
    price: 250,
    departureTime: '',
  });
  const [newExpense, setNewExpense] = useState<NewExpenseForm>({
    category: 'fixed',
    title: '',
    description: '',
    amount: 0,
    expenseDate: getLocalDateTimeValue(),
    paymentMethod: 'cash',
    notes: '',
  });

  const [discountConfig, setDiscountConfig] = useState<DiscountConfig>({
    childMaxAge: DISCOUNT_RULES.childMaxAge,
    childPercent: DISCOUNT_RULES.childPercent,
    seniorMinAge: DISCOUNT_RULES.seniorMinAge,
    seniorPercent: DISCOUNT_RULES.seniorPercent,
    childEnabled: DISCOUNT_RULES.childEnabled,
    seniorEnabled: DISCOUNT_RULES.seniorEnabled,
    disabilityEnabled: DISCOUNT_RULES.disabilityEnabled,
    disabilityPercent: DISCOUNT_RULES.disabilityPercent,
  });
  const [discountConfigSaving, setDiscountConfigSaving] = useState(false);

  const isAdminByEmail = authUser?.role === 'admin';
  const canOpenAdminGate = authUser?.role === 'admin';
  const canOpenDriverView = authUser?.role === 'driver';

  const roleLabel: Record<AppUserRole, string> = {
    admin: 'Administrador',
    seller: 'Vendedor',
    driver: 'Chofer',
  };

  const downloadCredentialsTxt = (records: CreatedCredentialRecord[]) => {
    if (records.length === 0 || typeof window === 'undefined') return;

    const rows: string[] = [
      'TERMINAL AU - CREDENCIALES GENERADAS',
      `Fecha de exportacion: ${new Date().toLocaleString()}`,
      `Total de registros: ${records.length}`,
      '',
    ];

    records.forEach((record, index) => {
      rows.push(`Registro ${index + 1}`);
      rows.push(`Creado: ${new Date(record.createdAt).toLocaleString()}`);
      rows.push(`Nombre: ${record.fullName}`);
      rows.push(`Rol: ${roleLabel[record.role]}`);
      rows.push(`Usuario/Correo: ${record.email}`);
      rows.push(`Contrasena: ${record.password}`);
      rows.push(`Sucursal: ${record.branchName}`);
      rows.push(`Terminal: ${record.terminalName}`);
      rows.push('----------------------------------------');
    });

    const textBlob = new Blob([rows.join('\n')], { type: 'text/plain;charset=utf-8' });
    const objectUrl = window.URL.createObjectURL(textBlob);
    const link = window.document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    link.href = objectUrl;
    link.download = `credenciales-terminal-au-${stamp}.txt`;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(objectUrl);
  };

  const request = async <T,>(path: string, init?: RequestInit): Promise<T> => {
    const headers = new Headers(init?.headers ?? {});
    headers.set('Content-Type', 'application/json');
    const token = authToken ?? window.localStorage.getItem(TOKEN_KEY);
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
    });

    if (!response.ok) {
      let message = `error_${response.status}`;
      try {
        const payload = (await response.json()) as { message?: string };
        message = payload.message ?? message;
      } catch (_error) {
        // ignore parse errors
      }
      throw new Error(message);
    }

    if (response.status === 204) return null as T;
    return (await response.json()) as T;
  };

  const loadTrips = async () => {
    const tripData = await request<Trip[]>('/api/trips');
    setTrips(tripData);
    setSelectedTrip((previous) => {
      if (!previous) return tripData[0] ?? null;
      return tripData.find((trip) => trip.id === previous.id) ?? tripData[0] ?? null;
    });
  };

  const loadTickets = async () => {
    const ticketData = await request<Ticket[]>('/api/tickets');
    setTickets(ticketData);
  };

  const loadExpenses = async () => {
    const expenseData = await request<Expense[]>('/api/expenses');
    setExpenses(expenseData);
  };

  const loadCurrentShift = async () => {
    const shiftData = await request<CashShift | null>('/api/operations/shifts/current');
    setCurrentShift(shiftData);
    if (shiftData) {
      setShiftClosingCash(Math.max(0, Number(shiftData.expectedCash.toFixed(2))));
    }
  };

  const loadOperationsContext = async () => {
    const contextRows = await request<OperationsContextUnit[]>('/api/operations/context');
    setOperationsContext(contextRows);
  };

  const loadEmployeesData = async () => {
    const [users, schedules] = await Promise.all([
      request<EmployeeUser[]>('/api/auth/users'),
      request<EmployeeSchedule[]>('/api/operations/schedules'),
    ]);
    setEmployeeUsers(users);
    setEmployeeSchedules(schedules);
  };

  const loadVehiclesData = async () => {
    const params = new URLSearchParams();
    if (authUser?.role === 'admin' && selectedBranchId !== 'all') {
      params.set('branchId', selectedBranchId);
    }
    if (authUser?.role === 'admin' && selectedTerminalId !== 'all') {
      params.set('terminalId', selectedTerminalId);
    }
    const suffix = params.toString().length > 0 ? `?${params.toString()}` : '';
    const vehicleRows = await request<VehicleRecord[]>(`/api/operations/vehicles${suffix}`);
    setVehicles(vehicleRows);
  };

  const loadVehicleIssuesData = async () => {
    const params = new URLSearchParams();
    if (authUser?.role === 'admin' && selectedBranchId !== 'all') {
      params.set('branchId', selectedBranchId);
    }
    if (authUser?.role === 'admin' && selectedTerminalId !== 'all') {
      params.set('terminalId', selectedTerminalId);
    }
    const suffix = params.toString().length > 0 ? `?${params.toString()}` : '';
    const issueRows = await request<VehicleIssueReport[]>(`/api/operations/vehicle-issues${suffix}`);
    setVehicleIssues(issueRows);
  };

  const getFirstTerminalByBranch = (branchId: string): string => {
    return operationsContext.find((item) => item.branchId === branchId)?.terminalId ?? '';
  };

  const loadOperationsData = async (includeAdminData: boolean) => {
    const tasks: Array<Promise<unknown>> = [loadCurrentShift()];
    if (includeAdminData) {
      const params = new URLSearchParams();
      if (selectedBranchId !== 'all') {
        params.set('branchId', selectedBranchId);
      }
      if (selectedTerminalId !== 'all') {
        params.set('terminalId', selectedTerminalId);
      }
      const suffix = params.toString().length > 0 ? `?${params.toString()}` : '';

      tasks.push(
        request<CashShift[]>(`/api/operations/shifts${suffix}`).then((rows) => setShiftHistory(rows)),
        request<OperationsKpi>(`/api/operations/kpi${suffix}`).then((kpi) => setOperationsKpi(kpi)),
      );
    } else {
      setShiftHistory([]);
      setOperationsKpi(null);
    }
    await Promise.all(tasks);
  };

  const loadData = async (userRole: AppUserRole | undefined = authUser?.role) => {
    const includeAdminData = userRole === 'admin';
    const includeDriverData = userRole === 'driver';

    const tasks: Array<Promise<unknown>> = [loadTrips(), loadTickets(), loadOperationsData(includeAdminData)];
    if (includeAdminData) {
      tasks.push(loadExpenses());
      tasks.push(loadOperationsContext());
      tasks.push(loadEmployeesData());
      tasks.push(loadVehiclesData());
      tasks.push(loadVehicleIssuesData());
    }
    if (includeDriverData) {
      tasks.push(loadVehiclesData());
      tasks.push(loadVehicleIssuesData());
    }
    await Promise.all(tasks);
  };

  const loadDiscountConfig = async () => {
    const config = await request<DiscountConfig>('/api/settings/discounts');
    setDiscountConfig(config);
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('terminal-branding', JSON.stringify(branding));
  }, [branding]);

  useEffect(() => {
    setBrandingDraft(branding);
  }, [branding]);

  useEffect(() => {
    if (location.pathname === '/ventas') {
      setView('sales');
      return;
    }
    if (location.pathname === '/chofer') {
      setView('driver');
      return;
    }
    if (location.pathname === '/admin') {
      setView('admin');
      return;
    }
    setView('seller');
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (hasAdminAccess) {
      window.sessionStorage.setItem(ADMIN_ACCESS_SESSION_KEY, '1');
    } else {
      window.sessionStorage.removeItem(ADMIN_ACCESS_SESSION_KEY);
    }
  }, [hasAdminAccess]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(ADMIN_TAB_SESSION_KEY, adminTab);
  }, [adminTab]);

  useEffect(() => {
    if (loading) return;
    if (!authUser) return;

    if (authUser.role === 'driver' && location.pathname !== '/chofer') {
      navigate('/chofer', { replace: true });
      return;
    }

    if (authUser.role !== 'driver' && location.pathname === '/chofer') {
      navigate('/pos', { replace: true });
      return;
    }

    if (location.pathname === '/admin' && authUser.role !== 'admin') {
      navigate('/pos', { replace: true });
      return;
    }
    if (location.pathname === '/admin' && !hasAdminAccess) {
      navigate('/pos', { replace: true });
    }
  }, [authUser, hasAdminAccess, loading, location.pathname, navigate]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!authToken) {
        setLoading(false);
        return;
      }

      try {
        const me = await request<{ user: ApiUser }>('/api/auth/me');
        if (cancelled) return;
        setAuthUser(me.user);
        await Promise.all([loadData(me.user.role), loadDiscountConfig()]);
        setApiError(null);
      } catch (_error) {
        if (!cancelled) {
          setAuthToken(null);
          setAuthUser(null);
          window.localStorage.removeItem(TOKEN_KEY);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!authUser && location.pathname !== '/login') {
      navigate('/login', { replace: true });
      return;
    }
    if (authUser && location.pathname === '/login') {
      navigate(authUser.role === 'driver' ? '/chofer' : '/pos', { replace: true });
    }
  }, [loading, authUser, location.pathname, navigate]);

  useEffect(() => {
    if (!authUser || authUser.role !== 'admin') return;
    void Promise.all([loadOperationsData(true), loadVehiclesData(), loadVehicleIssuesData()]);
  }, [selectedBranchId, selectedTerminalId]);

  useEffect(() => {
    setSelectedTerminalId('all');
  }, [selectedBranchId]);

  useEffect(() => {
    if (operationsContext.length === 0) return;

    setNewEmployee((previous) => {
      if (previous.branchId && previous.terminalId) return previous;
      const first = operationsContext[0];
      return {
        ...previous,
        branchId: previous.branchId || first.branchId,
        terminalId: previous.terminalId || first.terminalId,
      };
    });

    setNewSchedule((previous) => {
      if (previous.branchId && previous.terminalId) return previous;
      const first = operationsContext[0];
      return {
        ...previous,
        branchId: previous.branchId || first.branchId,
        terminalId: previous.terminalId || first.terminalId,
      };
    });

    setNewVehicle((previous) => {
      if (previous.branchId && previous.terminalId) return previous;
      const first = operationsContext[0];
      return {
        ...previous,
        branchId: previous.branchId || first.branchId,
        terminalId: previous.terminalId || first.terminalId,
      };
    });
  }, [operationsContext]);

  const filteredTrips = useMemo(() => {
    return trips.filter((trip) => {
      const matchesDestination = trip.destination.toLowerCase().includes(destinationFilter.toLowerCase());
      const matchesDate = dateFilter ? trip.departureTime.startsWith(dateFilter) : true;
      return matchesDestination && matchesDate;
    });
  }, [dateFilter, destinationFilter, trips]);

  const soldSeatsCount = useMemo(() => {
    if (!selectedTrip) return 0;
    return Object.values(selectedTrip.seats as Record<string, SeatInfo>).filter((seat) => seat.status === 'sold').length;
  }, [selectedTrip]);

  const filteredTickets = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();
    return tickets.filter((ticket) => ticket.passengerName.toLowerCase().includes(normalizedSearch));
  }, [searchTerm, tickets]);

  const totalSales = useMemo(() => {
    return tickets.filter((ticket) => ticket.status !== 'cancelled').reduce((sum, ticket) => sum + ticket.price, 0);
  }, [tickets]);

  const handleLogin = async (input: { email: string; password: string }) => {
    setAuthError(null);
    setAdminInfoMessage(null);
    setGeneratedDriverCredentials(null);
    setCreatedCredentialsLog([]);
    try {
      const payload = await request<{ token: string; user: ApiUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(input),
      });

      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(ADMIN_ACCESS_SESSION_KEY);
        window.sessionStorage.removeItem(ADMIN_TAB_SESSION_KEY);
      }
      setAuthToken(payload.token);
      setAuthUser(payload.user);
      setHasAdminAccess(false);
      setAdminTab('dashboard');
      window.localStorage.setItem(TOKEN_KEY, payload.token);
      await Promise.all([loadData(payload.user.role), loadDiscountConfig()]);
      navigate(payload.user.role === 'driver' ? '/chofer' : '/pos', { replace: true });
      setCredentials({ email: '', password: '' });
      setApiError(null);
    } catch (_error) {
      setAuthError('Credenciales invalidas o usuario inactivo.');
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setAuthUser(null);
    setHasAdminAccess(false);
    setAdminTab('dashboard');
    window.localStorage.removeItem(TOKEN_KEY);
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(ADMIN_ACCESS_SESSION_KEY);
      window.sessionStorage.removeItem(ADMIN_TAB_SESSION_KEY);
    }
    setTrips([]);
    setTickets([]);
    setExpenses([]);
    setCurrentShift(null);
    setShiftHistory([]);
    setOperationsKpi(null);
    setOperationsContext([]);
    setEmployeeUsers([]);
    setEmployeeSchedules([]);
    setVehicles([]);
    setVehicleIssues([]);
    setSelectedBranchId('all');
    setSelectedTerminalId('all');
    setNewBranch({ code: '', name: '' });
    setNewTerminal({ branchId: '', code: '', name: '' });
    setNewVehicle({
      branchId: '',
      terminalId: '',
      plateNumber: '',
      internalCode: '',
      vehicleType: 'autobus',
      capacity: 40,
      operationalStatus: 'active',
      photoUrl: '',
      notes: '',
      lastInspectionAt: '',
    });
    setNewVehicleIssue({ vehicleId: '', severity: 'medium', issueType: '', description: '' });
    setShiftOpeningCash(0);
    setShiftClosingCash(0);
    setShiftClosingNote('');
    setAdminInfoMessage(null);
    setGeneratedDriverCredentials(null);
    setCreatedCredentialsLog([]);
    navigate('/login', { replace: true });
  };

  const refreshTrips = async () => {
    try {
      await loadTrips();
      setApiError(null);
    } catch (_error) {
      setApiError('No se pudieron cargar corridas.');
    }
  };

  const onSelectSeat = (seatId: string) => {
    setSelectedSeat(seatId);
    setPassengerName('');
    setFareType('adult');
    setShowSaleModal(true);
  };

  const handleBuyTicket = async () => {
    if (!selectedTrip || !selectedSeat || !passengerName.trim()) return;
    setIsProcessing(true);

    try {
      const ticketResponse = await request<{
        ok: boolean;
        ticket: {
          id: string;
          folio?: string;
          tripId: string;
          routeId: string;
          origin: string;
          destination: string;
          departureTime: string;
          seatNumber: number;
          passengerName: string;
          passengerAge: number | null;
          fareType: 'adult' | 'child' | 'senior' | 'disability';
          basePrice: number;
          discountType: 'none' | 'child' | 'senior' | 'disability';
          discountPercent: number;
          discountAmount: number;
          price: number;
        };
      }>('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          tripId: selectedTrip.id,
          seatNumber: Number.parseInt(selectedSeat, 10),
          passengerName: passengerName.trim(),
          fareType,
        }),
      });

      await loadData();

      const generatedTicket: Ticket = {
        id: ticketResponse.ticket.id,
        folio: ticketResponse.ticket.folio,
        tripId: ticketResponse.ticket.tripId,
        seatNumber: ticketResponse.ticket.seatNumber,
        passengerName: ticketResponse.ticket.passengerName,
        passengerAge: ticketResponse.ticket.passengerAge,
        fareType: ticketResponse.ticket.fareType,
        basePrice: ticketResponse.ticket.basePrice,
        discountType: ticketResponse.ticket.discountType,
        discountPercent: ticketResponse.ticket.discountPercent,
        discountAmount: ticketResponse.ticket.discountAmount,
        price: ticketResponse.ticket.price,
        soldAt: new Date().toISOString(),
        uid: authUser?.id.toString() ?? '0',
        status: 'active',
        routeId: ticketResponse.ticket.routeId,
        origin: ticketResponse.ticket.origin,
        destination: ticketResponse.ticket.destination,
        departureTime: ticketResponse.ticket.departureTime,
      } as Ticket;

      setLastSoldTicket(generatedTicket);
      setLastPurchasedSeat(selectedSeat);
      setShowSaleModal(false);
      setShowTicketModal(true);
      setSelectedSeat(null);
      setPassengerName('');
      setFareType('adult');
      setApiError(null);

      window.setTimeout(() => {
        setLastPurchasedSeat((current) => (current === selectedSeat ? null : current));
      }, 2500);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'ticket_create_failed';
      if (message === 'seat_unavailable') {
        setApiError('El asiento ya fue vendido por otro usuario. Actualiza corridas.');
      } else if (message === 'passenger_name_required') {
        setApiError('Esta corrida requiere nombre del pasajero para emitir boleto.');
      } else if (message === 'invalid_passenger_age') {
        setApiError('Edad invalida. Captura un valor entre 0 y 120 anos.');
      } else if (message === 'fare_type_not_enabled') {
        setApiError('Ese tipo de descuento no esta habilitado por admin.');
      } else {
        setApiError('No se pudo emitir el boleto.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelTicket = (ticket: Ticket) => {
    setTicketToCancel(ticket);
    setShowCancelModal(true);
  };

  const confirmCancelTicket = async () => {
    if (!ticketToCancel) return;
    setIsProcessing(true);

    try {
      await request(`/api/tickets/${ticketToCancel.id}/cancel`, { method: 'PATCH' });
      await loadData();
      setShowCancelModal(false);
      setTicketToCancel(null);
      setApiError(null);
    } catch (_error) {
      setApiError('No se pudo cancelar el boleto. Verifica permisos de admin.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetTrip = async (tripId: string, routeId: string) => {
    try {
      await request(`/api/trips/${tripId}/reset`, { method: 'PATCH' });
      await loadData();
      setApiError(null);
    } catch (_error) {
      setApiError('No se pudo reiniciar la unidad.');
    }
  };

  const handleDeleteTrip = async (tripId: string, routeId: string) => {
    try {
      await request(`/api/trips/${tripId}`, { method: 'DELETE' });
      await loadData();
      setApiError(null);
    } catch (_error) {
      setApiError('No se pudo eliminar la unidad.');
    }
  };

  const createTrip = async () => {
    if (!newTrip.routeId || !newTrip.destination || !newTrip.departureTime) return;

    try {
      await request('/api/trips', {
        method: 'POST',
        body: JSON.stringify(newTrip),
      });

      await loadData();
      setNewTrip({
        routeId: '',
        origin: 'TERMINAL AU',
        destination: '',
        requiresPassengerName: true,
        vehicleType: 'autobus',
        seatCount: 40,
        price: 250,
        departureTime: '',
      });
      setApiError(null);
    } catch (_error) {
      setApiError('No se pudo crear la corrida.');
    }
  };

  const createExpense = async () => {
    if (!newExpense.title.trim() || newExpense.amount <= 0) return;

    try {
      await request('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          category: newExpense.category,
          title: newExpense.title.trim(),
          description: newExpense.description.trim(),
          amount: newExpense.amount,
          expenseDate: newExpense.expenseDate,
          paymentMethod: newExpense.paymentMethod,
          notes: newExpense.notes.trim(),
        }),
      });

      await loadExpenses();
      await loadOperationsData(authUser?.role === 'admin');
      setNewExpense({
        category: 'fixed',
        title: '',
        description: '',
        amount: 0,
        expenseDate: getLocalDateTimeValue(),
        paymentMethod: 'cash',
        notes: '',
      });
      setApiError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'expense_create_failed';
      if (message === 'invalid_expense_category') {
        setApiError('Categoria de gasto invalida.');
      } else if (message === 'invalid_expense_title') {
        setApiError('El gasto necesita un concepto con al menos 3 caracteres.');
      } else if (message === 'invalid_expense_amount') {
        setApiError('El monto del gasto debe ser mayor a 0.');
      } else if (message === 'invalid_expense_date') {
        setApiError('La fecha del gasto no es valida.');
      } else {
        setApiError('No se pudo registrar el gasto.');
      }
    }
  };

  const deleteExpense = async (expenseId: string) => {
    try {
      await request(`/api/expenses/${expenseId}`, { method: 'DELETE' });
      await loadExpenses();
      await loadOperationsData(authUser?.role === 'admin');
      setApiError(null);
    } catch (_error) {
      setApiError('No se pudo eliminar el gasto.');
    }
  };

  const openShift = async () => {
    try {
      await request('/api/operations/shifts/open', {
        method: 'POST',
        body: JSON.stringify({ openingCash: shiftOpeningCash }),
      });
      await loadOperationsData(authUser?.role === 'admin');
      setShiftOpeningCash(0);
      setApiError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'shift_open_failed';
      if (message === 'shift_already_open') {
        setApiError('Ya tienes un turno abierto. Debes cerrarlo antes de abrir otro.');
      } else if (message === 'shift_outside_schedule') {
        setApiError('No puedes abrir turno fuera de tu horario asignado por administracion.');
      } else if (message === 'invalid_opening_cash') {
        setApiError('El monto de apertura debe ser un numero valido y no negativo.');
      } else {
        setApiError('No se pudo abrir el turno.');
      }
    }
  };

  const closeShift = async () => {
    if (!currentShift) return;

    try {
      await request(`/api/operations/shifts/${currentShift.id}/close`, {
        method: 'POST',
        body: JSON.stringify({ closingCash: shiftClosingCash, closingNote: shiftClosingNote.trim() }),
      });
      await loadOperationsData(authUser?.role === 'admin');
      setShiftClosingCash(0);
      setShiftClosingNote('');
      setApiError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'shift_close_failed';
      if (message === 'shift_already_closed') {
        setApiError('Ese turno ya se encuentra cerrado.');
      } else if (message === 'shift_not_found') {
        setApiError('No se encontro el turno que intentas cerrar.');
      } else if (message === 'invalid_payload') {
        setApiError('El cierre requiere un monto valido de caja final.');
      } else {
        setApiError('No se pudo cerrar el turno.');
      }
    }
  };

  const createEmployee = async () => {
    const isDriver = newEmployee.role === 'driver';
    const hasValidManualCredentials = newEmployee.email.trim().length > 0 && newEmployee.password.length >= 10;
    const preparedFullName = newEmployee.fullName.trim();
    const preparedEmail = newEmployee.email.trim();
    const preparedPassword = newEmployee.password;
    const preparedRole = newEmployee.role;
    const preparedBranchId = newEmployee.branchId;
    const preparedTerminalId = newEmployee.terminalId;
    const contextUnit = operationsContext.find((item) => item.branchId === preparedBranchId && item.terminalId === preparedTerminalId);
    const preparedBranchName = contextUnit?.branchName ?? 'Sucursal';
    const preparedTerminalName = contextUnit?.terminalName ?? 'Terminal';

    if (!preparedFullName || !preparedBranchId || !preparedTerminalId || (!isDriver && !hasValidManualCredentials)) {
      setAdminInfoMessage(null);
      setApiError('Completa nombre, sucursal y terminal. Para admin/vendedor captura correo y contrasena (minimo 10 caracteres).');
      return;
    }

    try {
      const response = await request<{ ok: boolean; generatedCredentials?: { email: string; password: string } | null }>('/api/auth/users', {
        method: 'POST',
        body: JSON.stringify({
          fullName: preparedFullName,
          email: preparedEmail,
          password: preparedPassword,
          role: preparedRole,
          autoGenerateCredentials: isDriver,
          branchId: Number(preparedBranchId),
          terminalId: Number(preparedTerminalId),
        }),
      });

      const credentialEmail = response.generatedCredentials?.email ?? preparedEmail;
      const credentialPassword = response.generatedCredentials?.password ?? preparedPassword;
      setCreatedCredentialsLog((previous) => [
        {
          createdAt: new Date().toISOString(),
          fullName: preparedFullName,
          role: preparedRole,
          email: credentialEmail,
          password: credentialPassword,
          branchName: preparedBranchName,
          terminalName: preparedTerminalName,
        },
        ...previous,
      ]);

      await loadEmployeesData();
      setNewEmployee({ fullName: '', email: '', password: '', role: 'seller', branchId: '', terminalId: '' });
      if (response.generatedCredentials) {
        setGeneratedDriverCredentials({
          fullName: preparedFullName,
          email: response.generatedCredentials.email,
          password: response.generatedCredentials.password,
        });
        setAdminInfoMessage(null);
      } else {
        setGeneratedDriverCredentials(null);
        setAdminInfoMessage('Empleado creado correctamente.');
      }
      setApiError(null);
    } catch (error) {
      setAdminInfoMessage(null);
      setGeneratedDriverCredentials(null);
      const message = error instanceof Error ? error.message : 'employee_create_failed';
      if (message === 'user_already_exists') {
        setApiError('Ya existe un empleado con ese correo.');
      } else if (message === 'invalid_branch_terminal') {
        setApiError('La terminal seleccionada no pertenece a la sucursal.');
      } else {
        setApiError('No se pudo crear el empleado.');
      }
    }
  };

  const toggleEmployeeStatus = async (employee: EmployeeUser) => {
    try {
      await request(`/api/auth/users/${employee.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !employee.isActive }),
      });
      await loadEmployeesData();
      setApiError(null);
    } catch (_error) {
      setApiError('No se pudo actualizar el estado del empleado.');
    }
  };

  const createEmployeeSchedule = async () => {
    if (!newSchedule.userId || !newSchedule.branchId || !newSchedule.terminalId || !newSchedule.startTime || !newSchedule.endTime) {
      setApiError('Selecciona empleado, sucursal, terminal y horario.');
      return;
    }

    try {
      await request('/api/operations/schedules', {
        method: 'POST',
        body: JSON.stringify({
          userId: Number(newSchedule.userId),
          branchId: Number(newSchedule.branchId),
          terminalId: Number(newSchedule.terminalId),
          dayOfWeek: newSchedule.dayOfWeek,
          startTime: newSchedule.startTime,
          endTime: newSchedule.endTime,
          notes: newSchedule.notes.trim(),
        }),
      });
      await loadEmployeesData();
      setNewSchedule({ userId: '', branchId: '', terminalId: '', dayOfWeek: 0, startTime: '06:00', endTime: '15:00', notes: '' });
      setApiError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'schedule_create_failed';
      if (message === 'invalid_schedule_time') {
        setApiError('El horario es invalido: la hora inicial debe ser menor a la final.');
      } else if (message === 'invalid_branch_terminal') {
        setApiError('La terminal no pertenece a la sucursal elegida.');
      } else {
        setApiError('No se pudo crear el horario del empleado.');
      }
    }
  };

  const deleteEmployeeSchedule = async (scheduleId: string) => {
    try {
      await request(`/api/operations/schedules/${scheduleId}`, { method: 'DELETE' });
      await loadEmployeesData();
      setApiError(null);
    } catch (_error) {
      setApiError('No se pudo eliminar el horario.');
    }
  };

  const createBranch = async () => {
    if (!newBranch.code.trim() || !newBranch.name.trim()) {
      setApiError('Captura clave y nombre de la sucursal.');
      return;
    }

    try {
      await request('/api/operations/branches', {
        method: 'POST',
        body: JSON.stringify({ code: newBranch.code.trim().toUpperCase(), name: newBranch.name.trim() }),
      });
      await loadOperationsContext();
      setNewBranch({ code: '', name: '' });
      setApiError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'branch_create_failed';
      if (message === 'branch_code_exists') {
        setApiError('La clave de sucursal ya existe.');
      } else {
        setApiError('No se pudo crear la sucursal.');
      }
    }
  };

  const createTerminal = async () => {
    if (!newTerminal.branchId || !newTerminal.code.trim() || !newTerminal.name.trim()) {
      setApiError('Selecciona sucursal y captura clave/nombre de terminal.');
      return;
    }

    try {
      await request('/api/operations/terminals', {
        method: 'POST',
        body: JSON.stringify({ branchId: Number(newTerminal.branchId), code: newTerminal.code.trim().toUpperCase(), name: newTerminal.name.trim() }),
      });
      await loadOperationsContext();
      setNewTerminal({ branchId: newTerminal.branchId, code: '', name: '' });
      setApiError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'terminal_create_failed';
      if (message === 'terminal_code_exists') {
        setApiError('La clave de terminal ya existe en esa sucursal.');
      } else {
        setApiError('No se pudo crear la terminal.');
      }
    }
  };

  const createVehicle = async () => {
    if (!newVehicle.branchId || !newVehicle.terminalId || !newVehicle.plateNumber.trim()) {
      setApiError('Captura sucursal, terminal y placa del vehiculo.');
      return;
    }

    try {
      await request('/api/operations/vehicles', {
        method: 'POST',
        body: JSON.stringify({
          branchId: Number(newVehicle.branchId),
          terminalId: Number(newVehicle.terminalId),
          plateNumber: newVehicle.plateNumber.trim().toUpperCase(),
          internalCode: newVehicle.internalCode.trim(),
          vehicleType: newVehicle.vehicleType,
          capacity: newVehicle.capacity,
          operationalStatus: newVehicle.operationalStatus,
          photoUrl: newVehicle.photoUrl.trim(),
          notes: newVehicle.notes.trim(),
          lastInspectionAt: newVehicle.lastInspectionAt,
        }),
      });

      await loadVehiclesData();
      setNewVehicle({
        branchId: newVehicle.branchId,
        terminalId: newVehicle.terminalId,
        plateNumber: '',
        internalCode: '',
        vehicleType: 'autobus',
        capacity: 40,
        operationalStatus: 'active',
        photoUrl: '',
        notes: '',
        lastInspectionAt: '',
      });
      setApiError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'vehicle_create_failed';
      if (message === 'vehicle_duplicate_identifier') {
        setApiError('La placa o codigo interno ya existe en otro vehiculo.');
      } else {
        setApiError('No se pudo registrar el vehiculo.');
      }
    }
  };

  const updateVehicleStatus = async (vehicleId: string, operationalStatus: 'active' | 'maintenance' | 'inactive') => {
    try {
      await request(`/api/operations/vehicles/${vehicleId}`, {
        method: 'PATCH',
        body: JSON.stringify({ operationalStatus, isActive: operationalStatus !== 'inactive' }),
      });
      await loadVehiclesData();
      setApiError(null);
    } catch (_error) {
      setApiError('No se pudo actualizar el estado del vehiculo.');
    }
  };

  const createVehicleIssue = async () => {
    if (!newVehicleIssue.vehicleId || newVehicleIssue.issueType.trim().length < 3 || newVehicleIssue.description.trim().length < 8) {
      setApiError('Selecciona vehiculo y captura tipo/descripcion de falla (minimo 3 y 8 caracteres).');
      return;
    }

    try {
      await request('/api/operations/vehicle-issues', {
        method: 'POST',
        body: JSON.stringify({
          vehicleId: Number(newVehicleIssue.vehicleId),
          severity: newVehicleIssue.severity,
          issueType: newVehicleIssue.issueType.trim(),
          description: newVehicleIssue.description.trim(),
        }),
      });

      await Promise.all([loadVehiclesData(), loadVehicleIssuesData()]);
      setNewVehicleIssue({ vehicleId: '', severity: 'medium', issueType: '', description: '' });
      setApiError(null);
    } catch (_error) {
      setApiError('No se pudo registrar la falla del vehiculo.');
    }
  };

  const updateVehicleIssueStatus = async (issueId: string, status: 'reported' | 'in_repair' | 'resolved') => {
    try {
      await request(`/api/operations/vehicle-issues/${issueId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await Promise.all([loadVehiclesData(), loadVehicleIssuesData()]);
      setApiError(null);
    } catch (_error) {
      setApiError('No se pudo actualizar el estado del reporte.');
    }
  };

  const openAdminGate = () => {
    setAdminPassword('');
    setAdminError('');
    setShowAdminModal(true);
  };

  const saveBranding = () => {
    const normalizedHeroImages = (brandingDraft.heroImages ?? [])
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .slice(0, 4);
    const heroImageUrl = normalizedHeroImages[0] || brandingDraft.heroImageUrl.trim() || DEFAULT_BRANDING.heroImageUrl;

    setBranding({
      companyName: brandingDraft.companyName.trim() || DEFAULT_BRANDING.companyName,
      logoUrl: brandingDraft.logoUrl.trim(),
      heroImageUrl,
      heroImages: normalizedHeroImages.length > 0 ? normalizedHeroImages : [heroImageUrl],
      tagline: brandingDraft.tagline.trim() || DEFAULT_BRANDING.tagline,
    });
  };

  const saveDiscountConfig = async () => {
    if (!authUser || authUser.role !== 'admin') return;
    setDiscountConfigSaving(true);
    try {
      const payload = await request<{ ok: boolean; config: DiscountConfig }>('/api/settings/discounts', {
        method: 'PUT',
        body: JSON.stringify(discountConfig),
      });
      setDiscountConfig(payload.config);
      setApiError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'settings_update_failed';
      if (message === 'invalid_discount_ranges') {
        setApiError('Rangos invalidos: edad de nino debe ser menor que la de adulto mayor.');
      } else {
        setApiError('No se pudo guardar la configuracion de descuentos.');
      }
    } finally {
      setDiscountConfigSaving(false);
    }
  };

  const unlockAdminMode = async () => {
    if (!adminPassword.trim()) {
      setAdminError('Ingresa tu contrasena para acceder al panel admin.');
      return;
    }

    if (!authUser || authUser.role !== 'admin') {
      setAdminError('Tu usuario no tiene rol administrador.');
      return;
    }

    try {
      await request('/api/auth/reauth', {
        method: 'POST',
        body: JSON.stringify({ password: adminPassword.trim() }),
      });

      setHasAdminAccess(true);
      setView('admin');
      navigate('/admin');
      setShowAdminModal(false);
      setAdminPassword('');
      setAdminError('');
      setApiError(null);
    } catch (_error) {
      setAdminError('Contrasena incorrecta para validacion admin.');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0b1f24] text-white">
        <motion.div
          animate={{ opacity: [0.35, 1, 0.35], scale: [0.95, 1.05, 0.95] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-4"
        >
          <Bus className="h-6 w-6" />
          <span className="text-xs font-black uppercase tracking-[0.3em]">Cargando terminal</span>
        </motion.div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        branding={branding}
        authError={authError}
        credentials={credentials}
        setCredentials={setCredentials}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f8faf9] text-[#0f172a]">
      <AppHeader
        view={view}
        canAccessSalesViews={authUser.role !== 'driver'}
        canOpenAdminGate={canOpenAdminGate}
        canOpenDriverView={canOpenDriverView}
        userEmail={authUser.email}
        branding={branding}
        onGoSeller={() => navigate('/pos')}
        onGoSales={() => navigate('/ventas')}
        onGoDriver={() => navigate('/chofer')}
        onOpenAdmin={openAdminGate}
        onLogout={handleLogout}
      />

      <main className="mx-auto w-full max-w-[1680px] px-3 py-3 sm:px-4 lg:px-5 sm:py-4">
        {view === 'admin' && hasAdminAccess && createdCredentialsLog.length > 0 && (
          <div className="mb-3 rounded-xl border border-sky-300 bg-sky-50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-sky-900">
                Credenciales nuevas en esta sesion: <span className="font-black">{createdCredentialsLog.length}</span>
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => downloadCredentialsTxt(createdCredentialsLog)}
                  className="rounded-lg border border-sky-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-sky-800 hover:bg-sky-100"
                >
                  Descargar TXT
                </button>
                <button
                  type="button"
                  onClick={() => setCreatedCredentialsLog([])}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-black uppercase tracking-[0.1em] text-slate-700 hover:bg-slate-100"
                >
                  Limpiar lista
                </button>
              </div>
            </div>
          </div>
        )}

        {adminInfoMessage && (
          <div className="mb-3 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            {adminInfoMessage}
          </div>
        )}

        {apiError && (
          <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
            {apiError}
          </div>
        )}

        {view === 'seller' && (
          <SellerView
            filteredTrips={filteredTrips}
            selectedTrip={selectedTrip}
            selectedSeat={selectedSeat}
            lastPurchasedSeat={lastPurchasedSeat}
            soldSeatsCount={soldSeatsCount}
            destinationFilter={destinationFilter}
            dateFilter={dateFilter}
            setDestinationFilter={setDestinationFilter}
            setDateFilter={setDateFilter}
            onRefreshTrips={refreshTrips}
            onSelectTrip={(trip) => {
              setSelectedTrip(trip);
              setSelectedSeat(null);
            }}
            onSelectSeat={onSelectSeat}
          />
        )}

        {view === 'sales' && (
          <SalesView
            totalSales={totalSales}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filteredTickets={filteredTickets}
            trips={trips}
          />
        )}

        {view === 'driver' && (
          <DriverView
            vehicles={vehicles}
            vehicleIssues={vehicleIssues}
            newIssue={newVehicleIssue}
            setNewIssue={setNewVehicleIssue}
            createVehicleIssue={createVehicleIssue}
            updateVehicleIssueStatus={updateVehicleIssueStatus}
          />
        )}

        {view === 'admin' && hasAdminAccess && (
          <AdminView
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            isAdminByEmail={isAdminByEmail}
            totalSales={totalSales}
            tickets={tickets}
            expenses={expenses}
            currentShift={currentShift}
            shiftHistory={shiftHistory}
            operationsKpi={operationsKpi}
            operationsContext={operationsContext}
            selectedBranchId={selectedBranchId}
            setSelectedBranchId={setSelectedBranchId}
            selectedTerminalId={selectedTerminalId}
            setSelectedTerminalId={setSelectedTerminalId}
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
            shiftOpeningCash={shiftOpeningCash}
            setShiftOpeningCash={setShiftOpeningCash}
            shiftClosingCash={shiftClosingCash}
            setShiftClosingCash={setShiftClosingCash}
            shiftClosingNote={shiftClosingNote}
            setShiftClosingNote={setShiftClosingNote}
            openShift={openShift}
            closeShift={closeShift}
            trips={trips}
            newTrip={newTrip}
            setNewTrip={setNewTrip}
            createTrip={createTrip}
            newExpense={newExpense}
            setNewExpense={setNewExpense}
            createExpense={createExpense}
            deleteExpense={deleteExpense}
            handleResetTrip={handleResetTrip}
            handleDeleteTrip={handleDeleteTrip}
            handleCancelTicket={handleCancelTicket}
            setLastSoldTicket={setLastSoldTicket}
            setShowTicketModal={setShowTicketModal}
            brandingDraft={brandingDraft}
            setBrandingDraft={setBrandingDraft}
            saveBranding={saveBranding}
            discountConfig={discountConfig}
            setDiscountConfig={setDiscountConfig}
            saveDiscountConfig={saveDiscountConfig}
            discountConfigSaving={discountConfigSaving}
          />
        )}
      </main>

      <AdminAccessModal
        open={showAdminModal}
        adminPassword={adminPassword}
        adminError={adminError}
        setAdminPassword={setAdminPassword}
        onClose={() => setShowAdminModal(false)}
        onSubmit={unlockAdminMode}
      />

      <SaleModal
        open={showSaleModal}
        selectedTrip={selectedTrip}
        selectedSeat={selectedSeat}
        passengerName={passengerName}
        fareType={fareType}
        discountConfig={discountConfig}
        setPassengerName={setPassengerName}
        setFareType={setFareType}
        isProcessing={isProcessing}
        onClose={() => {
          setShowSaleModal(false);
          setSelectedSeat(null);
          setFareType('adult');
        }}
        onBuy={handleBuyTicket}
      />

      <CancelTicketModal
        open={showCancelModal}
        ticketToCancel={ticketToCancel}
        isProcessing={isProcessing}
        onClose={() => {
          setShowCancelModal(false);
          setTicketToCancel(null);
        }}
        onConfirm={confirmCancelTicket}
      />

      <TicketModal
        open={showTicketModal}
        lastSoldTicket={lastSoldTicket}
        branding={branding}
        onClose={() => setShowTicketModal(false)}
      />

      {generatedDriverCredentials && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-emerald-200 bg-white p-6 shadow-2xl">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700">Credenciales de chofer</p>
            <h3 className="mt-1 text-xl font-black tracking-tight text-slate-900">Acceso generado correctamente</h3>
            <p className="mt-2 text-sm text-slate-600">
              Chofer: <span className="font-black text-slate-900">{generatedDriverCredentials.fullName}</span>
            </p>

            <div className="mt-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Usuario / correo</p>
                <p className="mt-1 break-all text-base font-black text-slate-900">{generatedDriverCredentials.email}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Contrasena temporal</p>
                <p className="mt-1 break-all text-base font-black text-slate-900">{generatedDriverCredentials.password}</p>
              </div>
            </div>

            <p className="mt-4 text-xs font-semibold text-amber-700">
              Entrega estos datos al chofer y pide cambio de contrasena en su primer ingreso.
            </p>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const existingRecord = createdCredentialsLog.find(
                    (record) =>
                      record.email === generatedDriverCredentials.email &&
                      record.password === generatedDriverCredentials.password,
                  );
                  downloadCredentialsTxt([
                    existingRecord ?? {
                      createdAt: new Date().toISOString(),
                      fullName: generatedDriverCredentials.fullName,
                      role: 'driver',
                      email: generatedDriverCredentials.email,
                      password: generatedDriverCredentials.password,
                      branchName: 'Sucursal asignada',
                      terminalName: 'Terminal asignada',
                    },
                  ]);
                }}
                className="mr-2 rounded-xl border border-sky-300 bg-white px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-sky-800 hover:bg-sky-50"
              >
                Descargar TXT
              </button>
              <button
                type="button"
                onClick={() => setGeneratedDriverCredentials(null)}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black uppercase tracking-[0.12em] text-white hover:bg-emerald-700"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
          @media print {
            body * { visibility: hidden !important; }
            #printable-ticket, #printable-ticket * { visibility: visible !important; }
            #printable-ticket {
              position: fixed !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: white !important;
              color: black !important;
              padding: 20px !important;
            }
          }
        `,
        }}
      />
    </div>
  );
}
