import { Router } from 'express';
import pool from '../lib/db';
import { requireAdmin, requireAuth, type AuthRequest } from '../lib/auth';
import { FareType, getDiscountByFareType, roundMoney } from '../lib/discounts';
import { getDiscountConfig } from '../lib/discountConfig';

const ticketsRouter = Router();

ticketsRouter.get('/tickets', requireAuth, async (_req, res) => {
  const [rows] = await pool.query(
      `SELECT t.id, t.trip_id, t.seat_number, t.passenger_name, t.passenger_age, t.base_price,
        t.discount_type, t.discount_percent, t.price, t.sold_at, t.user_id, t.status,
            tr.route_id, tr.origin, tr.destination, tr.departure_time
     FROM tickets t
     JOIN trips tr ON tr.id = t.trip_id
     ORDER BY t.sold_at DESC`,
  );

  const result = (rows as Array<{
    id: number;
    trip_id: number;
    seat_number: number;
    passenger_name: string;
    passenger_age: number | null;
    base_price: number;
    discount_type: 'none' | 'child' | 'senior' | 'disability';
    discount_percent: number;
    price: number;
    sold_at: string;
    user_id: number;
    status: 'active' | 'cancelled';
    route_id: string;
    origin: string;
    destination: string;
    departure_time: string;
  }>).map((item) => ({
    id: item.id.toString(),
    tripId: item.trip_id.toString(),
    seatNumber: item.seat_number,
    passengerName: item.passenger_name,
    passengerAge: item.passenger_age,
    basePrice: Number(item.base_price),
    discountType: item.discount_type,
    discountPercent: Number(item.discount_percent),
    discountAmount: roundMoney(Number(item.base_price) * (Number(item.discount_percent) / 100)),
    price: Number(item.price),
    soldAt: new Date(item.sold_at).toISOString(),
    uid: item.user_id.toString(),
    status: item.status,
    routeId: item.route_id,
    origin: item.origin,
    destination: item.destination,
    departureTime: new Date(item.departure_time).toISOString(),
  }));

  res.json(result);
});

ticketsRouter.post('/tickets', requireAuth, async (req: AuthRequest, res) => {
  const { tripId, seatNumber, passengerName, passengerAge, fareType } = req.body as {
    tripId?: string;
    seatNumber?: number;
    passengerName?: string;
    passengerAge?: number;
    fareType?: FareType;
  };

  if (!tripId || !seatNumber || !req.user) {
    res.status(400).json({ message: 'invalid_payload' });
    return;
  }

  const normalizedFareType: FareType =
    fareType === 'child' || fareType === 'senior' || fareType === 'disability' ? fareType : 'adult';

  const normalizedPassengerAge =
    passengerAge === undefined || passengerAge === null || Number.isNaN(Number(passengerAge))
      ? null
      : Number.parseInt(String(passengerAge), 10);

  if (normalizedPassengerAge !== null && (!Number.isInteger(normalizedPassengerAge) || normalizedPassengerAge < 0 || normalizedPassengerAge > 120)) {
    res.status(400).json({ message: 'invalid_passenger_age' });
    return;
  }

  const tripIdNum = Number.parseInt(tripId, 10);
  if (Number.isNaN(tripIdNum)) {
    res.status(400).json({ message: 'invalid_trip_id' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [tripRows] = await connection.query(
      'SELECT id, route_id, origin, destination, requires_passenger_name, seat_count, departure_time, price FROM trips WHERE id = ? LIMIT 1 FOR UPDATE',
      [tripIdNum],
    );
    const trip = (tripRows as Array<{
      id: number;
      route_id: string;
      origin: string;
      destination: string;
      requires_passenger_name: number;
      seat_count: number;
      departure_time: string;
      price: number;
    }>)[0];

    if (!trip) {
      await connection.rollback();
      res.status(404).json({ message: 'trip_not_found' });
      return;
    }

    const tripSeatCount = trip.seat_count || 40;
    if (seatNumber < 1 || seatNumber > tripSeatCount) {
      await connection.rollback();
      res.status(400).json({ message: 'invalid_seat_number' });
      return;
    }

    const requiresPassengerName = trip.requires_passenger_name === 1;
    const resolvedPassengerName = (passengerName ?? '').trim();
    if (requiresPassengerName && resolvedPassengerName.length === 0) {
      await connection.rollback();
      res.status(400).json({ message: 'passenger_name_required' });
      return;
    }

    const finalPassengerName = resolvedPassengerName.length > 0 ? resolvedPassengerName : 'PUBLICO GENERAL';

    const [seatRows] = await connection.query(
      `SELECT id FROM tickets
       WHERE trip_id = ? AND seat_number = ? AND status = 'active'
       LIMIT 1
       FOR UPDATE`,
      [tripIdNum, seatNumber],
    );

    if ((seatRows as Array<{ id: number }>).length > 0) {
      await connection.rollback();
      res.status(409).json({ message: 'seat_unavailable' });
      return;
    }

    const basePrice = Number(trip.price);
    const discountConfig = await getDiscountConfig();

    if (normalizedFareType === 'child' && !discountConfig.childEnabled) {
      await connection.rollback();
      res.status(400).json({ message: 'fare_type_not_enabled' });
      return;
    }

    if (normalizedFareType === 'senior' && !discountConfig.seniorEnabled) {
      await connection.rollback();
      res.status(400).json({ message: 'fare_type_not_enabled' });
      return;
    }

    if (normalizedFareType === 'disability' && !discountConfig.disabilityEnabled) {
      await connection.rollback();
      res.status(400).json({ message: 'fare_type_not_enabled' });
      return;
    }

    const discount = getDiscountByFareType(normalizedFareType, discountConfig);
    const discountAmount = roundMoney(basePrice * (discount.percent / 100));
    const finalPrice = roundMoney(basePrice - discountAmount);

    await connection.query(
      `INSERT INTO tickets (
        trip_id, seat_number, passenger_name, passenger_age, base_price,
        discount_type, discount_percent, price, sold_at, user_id, status
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 'active')`,
      [
        tripIdNum,
        seatNumber,
        finalPassengerName,
        normalizedPassengerAge,
        basePrice,
        discount.type,
        discount.percent,
        finalPrice,
        req.user.id,
      ],
    );

    await connection.commit();

    res.status(201).json({
      ok: true,
      ticket: {
        tripId: trip.id.toString(),
        routeId: trip.route_id,
        origin: trip.origin,
        destination: trip.destination,
        departureTime: new Date(trip.departure_time).toISOString(),
        seatNumber,
        passengerName: finalPassengerName,
        passengerAge: normalizedPassengerAge,
        fareType: normalizedFareType,
        basePrice,
        discountType: discount.type,
        discountPercent: discount.percent,
        discountAmount,
        price: finalPrice,
      },
    });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'ticket_create_failed' });
  } finally {
    connection.release();
  }
});

ticketsRouter.patch('/tickets/:ticketId/cancel', requireAuth, requireAdmin, async (req, res) => {
  const ticketId = Number.parseInt(req.params.ticketId, 10);
  if (Number.isNaN(ticketId)) {
    res.status(400).json({ message: 'invalid_ticket_id' });
    return;
  }

  await pool.query("UPDATE tickets SET status = 'cancelled' WHERE id = ?", [ticketId]);
  res.json({ ok: true });
});

export default ticketsRouter;
