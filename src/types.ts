export enum TripStatus {
  SCHEDULED = 'scheduled',
  IN_TRANSIT = 'in-transit',
  ARRIVED = 'arrived',
  COMPLETED = 'completed',
}

export interface SeatInfo {
  status: 'available' | 'sold';
  passengerName?: string;
  soldAt?: string;
}

export type VehicleType = 'sprinter' | 'minibus' | 'autobus' | 'autobus_xl';
export type VehicleOperationalStatus = 'active' | 'maintenance' | 'inactive';
export type AppUserRole = 'admin' | 'seller' | 'driver';
export type VehicleIssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type VehicleIssueStatus = 'reported' | 'in_repair' | 'resolved';

export type ExpenseCategory = 'fixed' | 'variable' | 'payroll';

export type ExpensePaymentMethod = 'cash' | 'transfer' | 'card' | 'other';

export interface Branch {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface TerminalUnit {
  id: string;
  branchId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export interface OperationsContextUnit {
  branchId: string;
  branchCode: string;
  branchName: string;
  terminalId: string;
  terminalCode: string;
  terminalName: string;
}

export interface Trip {
  id: string;
  routeId: string;
  origin: string;
  destination: string;
  requiresPassengerName: boolean;
  vehicleType: VehicleType;
  seatCount: number;
  departureTime: string;
  arrivalTime: string;
  price: number;
  status: TripStatus;
  seats: { [key: string]: SeatInfo };
}

export interface Ticket {
  id: string;
  folio?: string;
  tripId: string;
  seatNumber: number;
  passengerName: string;
  passengerAge?: number | null;
  basePrice?: number;
  discountType?: 'none' | 'child' | 'senior' | 'disability';
  fareType?: 'adult' | 'child' | 'senior' | 'disability';
  discountPercent?: number;
  discountAmount?: number;
  price: number;
  soldAt: string;
  uid: string;
  status: 'active' | 'cancelled';
}

export interface CashShift {
  id: string;
  userId: string;
  userEmail: string;
  branchId: string;
  branchName: string;
  terminalId: string;
  terminalName: string;
  openingCash: number;
  openingNote?: string | null;
  expectedCash: number;
  closingCash?: number | null;
  difference?: number | null;
  closingNote?: string | null;
  openedAt: string;
  closedAt?: string | null;
  status: 'open' | 'closed';
}

export interface EmployeeUser {
  id: string;
  email: string;
  fullName: string;
  role: AppUserRole;
  isActive: boolean;
  branchId: string;
  branchName: string;
  terminalId: string;
  terminalName: string;
}

export interface VehicleIssueReport {
  id: string;
  vehicleId: string;
  vehiclePlateNumber: string;
  vehicleInternalCode?: string | null;
  vehicleType: VehicleType;
  branchId: string;
  branchName: string;
  terminalId: string;
  terminalName: string;
  reportedByUserId: string;
  reportedByName: string;
  reportedByEmail: string;
  severity: VehicleIssueSeverity;
  issueType: string;
  description: string;
  status: VehicleIssueStatus;
  reportedAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
}

export interface EmployeeSchedule {
  id: string;
  userId: string;
  employeeName: string;
  branchId: string;
  branchName: string;
  terminalId: string;
  terminalName: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  notes?: string | null;
  isActive: boolean;
}

export interface VehicleRecord {
  id: string;
  branchId: string;
  branchName: string;
  terminalId: string;
  terminalName: string;
  plateNumber: string;
  internalCode?: string | null;
  vehicleType: VehicleType;
  capacity: number;
  operationalStatus: VehicleOperationalStatus;
  photoUrl?: string | null;
  notes?: string | null;
  lastInspectionAt?: string | null;
  isActive: boolean;
}

export interface OperationsKpi {
  revenueMonth: number;
  discountsMonth: number;
  cancelLossMonth: number;
  expensesMonth: number;
  netUtilityMonth: number;
}

export interface Expense {
  id: string;
  category: ExpenseCategory;
  title: string;
  description?: string;
  amount: number;
  expenseDate: string;
  paymentMethod: ExpensePaymentMethod;
  notes?: string;
  createdBy: string;
  createdByEmail?: string;
  createdAt: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  role: 'admin' | 'user';
}

export interface DiscountConfig {
  childMaxAge: number;
  childPercent: number;
  seniorMinAge: number;
  seniorPercent: number;
  childEnabled: boolean;
  seniorEnabled: boolean;
  disabilityEnabled: boolean;
  disabilityPercent: number;
}
