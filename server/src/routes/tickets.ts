import { Router } from 'express';
import pool from '../lib/db';
import { requireAdmin, requireAuth, type AuthRequest } from '../lib/auth';
import { FareType, getDiscountByFareType, roundMoney } from '../lib/discounts';
import { getDiscountConfig } from '../lib/discountConfig';

const ticketsRouter = Router();

type IdempotencyRecord = {
  statusCode: number;
  responseBody: unknown;
};

async function findIdempotencyRecord(idempotencyKey: string, endpoint: string, userId: number): Promise<IdempotencyRecord | null> {
  const [rows] = await pool.query(
    `SELECT status_code, response_body
     FROM idempotency_keys
     WHERE idempotency_key = ? AND endpoint = ? AND user_id = ?
     LIMIT 1`,
    [idempotencyKey, endpoint, userId],
  );

  const row = (rows as Array<{ status_code: number; response_body: unknown }>)[0];
  if (!row) return null;

  return {
    statusCode: row.status_code,
    responseBody: row.response_body,
  };
}

async function saveIdempotencyRecord(
  idempotencyKey: string,
  endpoint: string,
  userId: number,
  statusCode: number,
  responseBody: unknown,
): Promise<void> {
  await pool.query(
    `INSERT IGNORE INTO idempotency_keys (idempotency_key, endpoint, user_id, status_code, response_body)
     VALUES (?, ?, ?, ?, ?)`,
    [idempotencyKey, endpoint, userId, statusCode, JSON.stringify(responseBody)],
  );
}

async function getOpenShiftId(connection: Awaited<ReturnType<typeof pool.getConnection>>, userId: number): Promise<number | null> {
  const [rows] = await connection.query(
    `SELECT id
     FROM cashier_shifts
     WHERE user_id = ? AND status = 'open'
     ORDER BY id DESC
     LIMIT 1
     FOR UPDATE`,
    [userId],
  );

  return (rows as Array<{ id: number }>)[0]?.id ?? null;
}

ticketsRouter.get('/tickets', requireAuth, async (_req, res) => {
  const [rows] = await pool.query(
      `SELECT t.id, t.ticket_folio, t.trip_id, t.seat_number, t.passenger_name, t.passenger_age, t.base_price,
        t.discount_type, t.discount_percent, t.price, t.sold_at, t.user_id, t.status,
            tr.route_id, tr.origin, tr.destination, tr.departure_time
     FROM tickets t
     JOIN trips tr ON tr.id = t.trip_id
     ORDER BY t.sold_at DESC`,
  );

  const result = (rows as Array<{
    id: number;
    ticket_folio: number;
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
    folio: item.ticket_folio.toString(),
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

  const idempotencyKey = req.header('Idempotency-Key')?.trim() ?? '';
  if (idempotencyKey.length > 0) {
    const cached = await findIdempotencyRecord(idempotencyKey, 'tickets:create', req.user.id);
    if (cached) {
      res.status(cached.statusCode).json(cached.responseBody);
      return;
    }
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

    let openShiftId = await getOpenShiftId(connection, req.user.id);
    if (!openShiftId) {
      const [shiftInsert] = await connection.query(
        `INSERT INTO cashier_shifts (user_id, branch_id, terminal_id, opening_cash, expected_cash, opened_at, status)
         VALUES (?, ?, ?, 0, 0, NOW(), 'open')`,
        [req.user.id, req.user.branchId, req.user.terminalId],
      );
      openShiftId = (shiftInsert as { insertId: number }).insertId;

      await connection.query(
        `INSERT INTO financial_events (
          shift_id, user_id, branch_id, terminal_id, event_type, amount, reference_type, reference_id, notes, metadata, created_at
        ) VALUES (?, ?, ?, ?, 'shift_open', 0, 'shift', ?, 'Apertura automatica por operacion', JSON_OBJECT('autoOpened', true), NOW())`,
        [openShiftId, req.user.id, req.user.branchId, req.user.terminalId, String(openShiftId)],
      );
    }

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

    const [folioInsert] = await connection.query('INSERT INTO ticket_folios () VALUES ()');
    const ticketFolio = (folioInsert as { insertId: number }).insertId;

    const [ticketInsert] = await connection.query(
      `INSERT INTO tickets (
        ticket_folio, branch_id, terminal_id, trip_id, seat_number, passenger_name, passenger_age, base_price,
        discount_type, discount_percent, price, sold_at, user_id, status, idempotency_key
      )
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?, 'active', ?)`,
      [
        ticketFolio,
        req.user.branchId,
        req.user.terminalId,
        tripIdNum,
        seatNumber,
        finalPassengerName,
        normalizedPassengerAge,
        basePrice,
        discount.type,
        discount.percent,
        finalPrice,
        req.user.id,
        idempotencyKey.length > 0 ? idempotencyKey : null,
      ],
    );

    const ticketId = (ticketInsert as { insertId: number }).insertId;

    await connection.query(
      `INSERT INTO financial_events (
        shift_id, user_id, branch_id, terminal_id, event_type, amount, reference_type, reference_id, notes, metadata, created_at
      ) VALUES (?, ?, ?, ?, 'ticket_sale', ?, 'ticket', ?, 'Venta de boleto', JSON_OBJECT('tripId', ?, 'seatNumber', ?, 'ticketFolio', ?), NOW())`,
      [
        openShiftId,
        req.user.id,
        req.user.branchId,
        req.user.terminalId,
        finalPrice,
        String(ticketId),
        String(tripIdNum),
        seatNumber,
        ticketFolio,
      ],
    );

    await connection.query(
      `UPDATE cashier_shifts
       SET expected_cash = expected_cash + ?
       WHERE id = ?`,
      [finalPrice, openShiftId],
    );

    await connection.query(
      `INSERT INTO event_jobs (job_type, payload, status, scheduled_at)
       VALUES ('ticket_sale_report', JSON_OBJECT('ticketId', ?, 'ticketFolio', ?), 'pending', NOW())`,
      [ticketId, ticketFolio],
    );

    await connection.commit();

    const responsePayload = {
      ok: true,
      ticket: {
        id: ticketId.toString(),
        folio: ticketFolio.toString(),
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
    };

    if (idempotencyKey.length > 0) {
      await saveIdempotencyRecord(idempotencyKey, 'tickets:create', req.user.id, 201, responsePayload);
    }

    res.status(201).json(responsePayload);
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'ticket_create_failed' });
  } finally {
    connection.release();
  }
});

ticketsRouter.patch('/tickets/:ticketId/cancel', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'missing_user' });
    return;
  }

  const idempotencyKey = req.header('Idempotency-Key')?.trim() ?? '';
  if (idempotencyKey.length > 0) {
    const cached = await findIdempotencyRecord(idempotencyKey, 'tickets:cancel', req.user.id);
    if (cached) {
      res.status(cached.statusCode).json(cached.responseBody);
      return;
    }
  }

  const ticketId = Number.parseInt(req.params.ticketId, 10);
  if (Number.isNaN(ticketId)) {
    res.status(400).json({ message: 'invalid_ticket_id' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [ticketRows] = await connection.query(
      `SELECT id, price, status
       FROM tickets
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [ticketId],
    );

    const ticket = (ticketRows as Array<{ id: number; price: number; status: 'active' | 'cancelled' }>)[0];
    if (!ticket) {
      await connection.rollback();
      res.status(404).json({ message: 'ticket_not_found' });
      return;
    }

    if (ticket.status === 'cancelled') {
      await connection.rollback();
      const payload = { ok: true, alreadyCancelled: true };
      if (idempotencyKey.length > 0) {
        await saveIdempotencyRecord(idempotencyKey, 'tickets:cancel', req.user.id, 200, payload);
      }
      res.json(payload);
      return;
    }

    let openShiftId = await getOpenShiftId(connection, req.user.id);
    if (!openShiftId) {
      const [shiftInsert] = await connection.query(
        `INSERT INTO cashier_shifts (user_id, branch_id, terminal_id, opening_cash, expected_cash, opened_at, status)
         VALUES (?, ?, ?, 0, 0, NOW(), 'open')`,
        [req.user.id, req.user.branchId, req.user.terminalId],
      );
      openShiftId = (shiftInsert as { insertId: number }).insertId;

      await connection.query(
        `INSERT INTO financial_events (
          shift_id, user_id, branch_id, terminal_id, event_type, amount, reference_type, reference_id, notes, metadata, created_at
        ) VALUES (?, ?, ?, ?, 'shift_open', 0, 'shift', ?, 'Apertura automatica por operacion', JSON_OBJECT('autoOpened', true), NOW())`,
        [openShiftId, req.user.id, req.user.branchId, req.user.terminalId, String(openShiftId)],
      );
    }

    await connection.query("UPDATE tickets SET status = 'cancelled' WHERE id = ?", [ticketId]);

    await connection.query(
      `INSERT INTO financial_events (
        shift_id, user_id, branch_id, terminal_id, event_type, amount, reference_type, reference_id, notes, metadata, created_at
      ) VALUES (?, ?, ?, ?, 'ticket_cancel', ?, 'ticket', ?, 'Cancelacion de boleto', JSON_OBJECT('ticketId', ?), NOW())`,
      [openShiftId, req.user.id, req.user.branchId, req.user.terminalId, -Math.abs(Number(ticket.price)), String(ticketId), String(ticketId)],
    );

    await connection.query(
      `UPDATE cashier_shifts
       SET expected_cash = expected_cash - ?
       WHERE id = ?`,
      [Math.abs(Number(ticket.price)), openShiftId],
    );

    await connection.query(
      `INSERT INTO event_jobs (job_type, payload, status, scheduled_at)
       VALUES ('ticket_cancel_report', JSON_OBJECT('ticketId', ?), 'pending', NOW())`,
      [ticketId],
    );

    await connection.commit();

    const payload = { ok: true };
    if (idempotencyKey.length > 0) {
      await saveIdempotencyRecord(idempotencyKey, 'tickets:cancel', req.user.id, 200, payload);
    }
    res.json(payload);
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'ticket_cancel_failed' });
  } finally {
    connection.release();
  }
});

export default ticketsRouter;
