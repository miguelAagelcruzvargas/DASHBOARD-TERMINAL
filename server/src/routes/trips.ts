import { Router } from 'express';
import pool from '../lib/db';
import { requireAdmin, requireAuth, type AuthRequest } from '../lib/auth';

const tripsRouter = Router();
const VEHICLE_TYPE_TO_SEAT_COUNT = {
  sprinter: 15,
  minibus: 28,
  autobus: 40,
  autobus_xl: 60,
} as const;

function createEmptySeats(count: number) {
  const seats: Record<string, { status: 'available' | 'sold'; passengerName?: string; soldAt?: string }> = {};
  for (let i = 1; i <= count; i += 1) {
    seats[i.toString()] = { status: 'available' };
  }
  return seats;
}

tripsRouter.get('/trips', requireAuth, async (_req, res) => {
  const [tripRows] = await pool.query(
    `SELECT id, route_id, origin, destination, requires_passenger_name, vehicle_type, seat_count, departure_time, arrival_time, price, status
     FROM trips
     ORDER BY departure_time ASC`,
  );

  const trips = tripRows as Array<{
    id: number;
    route_id: string;
    origin: string;
    destination: string;
    requires_passenger_name: number;
    vehicle_type: string;
    seat_count: number;
    departure_time: string;
    arrival_time: string;
    price: number;
    status: string;
  }>;

  const ids = trips.map((trip) => trip.id);
  const seatsByTrip: Record<number, ReturnType<typeof createEmptySeats>> = {};

  for (const trip of trips) {
    seatsByTrip[trip.id] = createEmptySeats(trip.seat_count || 40);
  }

  if (ids.length > 0) {
    const [ticketRows] = await pool.query(
      `SELECT trip_id, seat_number, passenger_name, sold_at
       FROM tickets
       WHERE status = 'active' AND trip_id IN (${ids.map(() => '?').join(',')})`,
      ids,
    );

    for (const item of ticketRows as Array<{ trip_id: number; seat_number: number; passenger_name: string; sold_at: string }>) {
      const tripSeats = seatsByTrip[item.trip_id];
      if (!tripSeats) continue;
      tripSeats[item.seat_number.toString()] = {
        status: 'sold',
        passengerName: item.passenger_name,
        soldAt: new Date(item.sold_at).toISOString(),
      };
    }
  }

  res.json(
    trips.map((trip) => ({
      id: trip.id.toString(),
      routeId: trip.route_id,
      origin: trip.origin,
      destination: trip.destination,
      requiresPassengerName: trip.requires_passenger_name === 1,
      vehicleType: (trip.vehicle_type as keyof typeof VEHICLE_TYPE_TO_SEAT_COUNT) || 'autobus',
      seatCount: trip.seat_count || 40,
      departureTime: new Date(trip.departure_time).toISOString(),
      arrivalTime: new Date(trip.arrival_time).toISOString(),
      price: Number(trip.price),
      status: trip.status,
      seats: seatsByTrip[trip.id],
    })),
  );
});

tripsRouter.post('/trips', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const { routeId, origin, destination, price, departureTime, requiresPassengerName, vehicleType, seatCount } = req.body as {
    routeId?: string;
    origin?: string;
    destination?: string;
    price?: number;
    departureTime?: string;
    requiresPassengerName?: boolean;
    vehicleType?: string;
    seatCount?: number;
  };

  if (!routeId || !origin || !destination || !departureTime || typeof price !== 'number') {
    res.status(400).json({ message: 'invalid_payload' });
    return;
  }

  const normalizedVehicleType = vehicleType && vehicleType in VEHICLE_TYPE_TO_SEAT_COUNT
    ? (vehicleType as keyof typeof VEHICLE_TYPE_TO_SEAT_COUNT)
    : 'autobus';

  const normalizedSeatCount = typeof seatCount === 'number' && seatCount >= 4 && seatCount <= 80
    ? seatCount
    : VEHICLE_TYPE_TO_SEAT_COUNT[normalizedVehicleType];

  const departure = new Date(departureTime);
  const arrival = new Date(departure.getTime() + 2 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO trips (route_id, origin, destination, requires_passenger_name, vehicle_type, seat_count, departure_time, arrival_time, price, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
    [routeId, origin, destination, requiresPassengerName === false ? 0 : 1, normalizedVehicleType, normalizedSeatCount, departure, arrival, price],
  );

  res.status(201).json({ ok: true });
});

tripsRouter.patch('/trips/:tripId/reset', requireAuth, requireAdmin, async (req, res) => {
  const tripId = Number.parseInt(req.params.tripId, 10);
  if (Number.isNaN(tripId)) {
    res.status(400).json({ message: 'invalid_trip_id' });
    return;
  }

  await pool.query("UPDATE tickets SET status = 'cancelled' WHERE trip_id = ? AND status = 'active'", [tripId]);
  await pool.query("UPDATE trips SET status = 'scheduled' WHERE id = ?", [tripId]);
  res.json({ ok: true });
});

tripsRouter.delete('/trips/:tripId', requireAuth, requireAdmin, async (req, res) => {
  const tripId = Number.parseInt(req.params.tripId, 10);
  if (Number.isNaN(tripId)) {
    res.status(400).json({ message: 'invalid_trip_id' });
    return;
  }

  await pool.query('DELETE FROM tickets WHERE trip_id = ?', [tripId]);
  await pool.query('DELETE FROM trips WHERE id = ?', [tripId]);
  res.json({ ok: true });
});

export default tripsRouter;
