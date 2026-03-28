import React, { useEffect, useMemo, useState } from 'react';
import { Bus } from 'lucide-react';
import { motion } from 'motion/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { DiscountConfig, Expense, ExpenseCategory, ExpensePaymentMethod, SeatInfo, Ticket, Trip, TripStatus, VehicleType } from '../types';
import { LoginScreen } from '../components/terminal/LoginScreen';
import { AppHeader } from '../components/terminal/AppHeader';
import { SellerView } from '../components/terminal/SellerView';
import { SalesView } from '../components/terminal/SalesView';
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
  role: 'admin' | 'seller';
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

  const [hasAdminAccess, setHasAdminAccess] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(ADMIN_ACCESS_SESSION_KEY) === '1';
  });

  const [view, setView] = useState<ViewMode>('seller');
  const [adminTab, setAdminTab] = useState<AdminTab>(() => {
    if (typeof window === 'undefined') return 'dashboard';
    const stored = window.sessionStorage.getItem(ADMIN_TAB_SESSION_KEY);
    return stored === 'dashboard' || stored === 'create' || stored === 'trips' || stored === 'sales' || stored === 'expenses' || stored === 'branding'
      ? stored
      : 'dashboard';
  });

  const [trips, setTrips] = useState<Trip[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);

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

  const loadData = async (includeExpenses = authUser?.role === 'admin') => {
    const tasks: Array<Promise<unknown>> = [loadTrips(), loadTickets()];
    if (includeExpenses) {
      tasks.push(loadExpenses());
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
        await Promise.all([loadData(me.user.role === 'admin'), loadDiscountConfig()]);
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
      navigate('/pos', { replace: true });
    }
  }, [loading, authUser, location.pathname, navigate]);

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
      await Promise.all([loadData(payload.user.role === 'admin'), loadDiscountConfig()]);
      navigate('/pos', { replace: true });
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
        id: `temp-${Date.now()}`,
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
      setApiError(null);
    } catch (_error) {
      setApiError('No se pudo eliminar el gasto.');
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
        canOpenAdminGate={canOpenAdminGate}
        userEmail={authUser.email}
        branding={branding}
        onGoSeller={() => navigate('/pos')}
        onGoSales={() => navigate('/ventas')}
        onOpenAdmin={openAdminGate}
        onLogout={handleLogout}
      />

      <main className="mx-auto w-full max-w-[1680px] px-3 py-3 sm:px-4 lg:px-5 sm:py-4">
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

        {view === 'admin' && hasAdminAccess && (
          <AdminView
            adminTab={adminTab}
            setAdminTab={setAdminTab}
            isAdminByEmail={isAdminByEmail}
            totalSales={totalSales}
            tickets={tickets}
            expenses={expenses}
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
