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

export type ExpenseCategory = 'fixed' | 'variable' | 'payroll';

export type ExpensePaymentMethod = 'cash' | 'transfer' | 'card' | 'other';

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
