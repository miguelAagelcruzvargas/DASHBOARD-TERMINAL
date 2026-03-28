import { Router } from 'express';
import pool from '../lib/db';
import { getObservabilitySnapshot } from '../lib/observability';
import { requireAdmin, requireAuth, type AuthRequest } from '../lib/auth';

const operationsRouter = Router();

function parseOptionalPositiveInt(value: unknown): number | null {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

type ContextRow = {
  branch_id: number;
  branch_code: string;
  branch_name: string;
  terminal_id: number;
  terminal_code: string;
  terminal_name: string;
};

operationsRouter.get('/operations/context', requireAuth, async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT b.id AS branch_id, b.code AS branch_code, b.name AS branch_name,
            t.id AS terminal_id, t.code AS terminal_code, t.name AS terminal_name
     FROM branches b
     JOIN terminals t ON t.branch_id = b.id
     WHERE b.is_active = 1 AND t.is_active = 1
     ORDER BY b.name ASC, t.name ASC`,
  );

  const payload = (rows as ContextRow[]).map((row) => ({
    branchId: row.branch_id.toString(),
    branchCode: row.branch_code,
    branchName: row.branch_name,
    terminalId: row.terminal_id.toString(),
    terminalCode: row.terminal_code,
    terminalName: row.terminal_name,
  }));

  res.json(payload);
});

operationsRouter.post('/operations/branches', requireAuth, requireAdmin, async (req, res) => {
  const code = String((req.body as { code?: string }).code ?? '').trim().toUpperCase();
  const name = String((req.body as { name?: string }).name ?? '').trim();

  if (code.length < 2 || code.length > 30 || name.length < 3 || name.length > 120) {
    res.status(400).json({ message: 'invalid_branch_payload' });
    return;
  }

  try {
    await pool.query('INSERT INTO branches (code, name, is_active) VALUES (?, ?, 1)', [code, name]);
    res.status(201).json({ ok: true });
  } catch (error) {
    const mysqlError = error as { code?: string };
    if (mysqlError.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ message: 'branch_code_exists' });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'branch_create_failed' });
  }
});

operationsRouter.post('/operations/terminals', requireAuth, requireAdmin, async (req, res) => {
  const branchId = Number((req.body as { branchId?: number }).branchId ?? 0);
  const code = String((req.body as { code?: string }).code ?? '').trim().toUpperCase();
  const name = String((req.body as { name?: string }).name ?? '').trim();

  if (!Number.isInteger(branchId) || branchId <= 0 || code.length < 1 || code.length > 30 || name.length < 3 || name.length > 120) {
    res.status(400).json({ message: 'invalid_terminal_payload' });
    return;
  }

  const [branchRows] = await pool.query('SELECT id FROM branches WHERE id = ? AND is_active = 1 LIMIT 1', [branchId]);
  if ((branchRows as Array<{ id: number }>).length === 0) {
    res.status(400).json({ message: 'branch_not_found' });
    return;
  }

  try {
    await pool.query('INSERT INTO terminals (branch_id, code, name, is_active) VALUES (?, ?, ?, 1)', [branchId, code, name]);
    res.status(201).json({ ok: true });
  } catch (error) {
    const mysqlError = error as { code?: string };
    if (mysqlError.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ message: 'terminal_code_exists' });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'terminal_create_failed' });
  }
});

operationsRouter.get('/operations/vehicles', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'missing_user' });
    return;
  }

  const branchId = parseOptionalPositiveInt(req.query.branchId);
  const terminalId = parseOptionalPositiveInt(req.query.terminalId);

  if (req.user.role !== 'admin') {
    if ((branchId && branchId !== req.user.branchId) || (terminalId && terminalId !== req.user.terminalId)) {
      res.status(403).json({ message: 'invalid_scope' });
      return;
    }
  }

  const resolvedBranchId = req.user.role === 'admin' ? branchId : req.user.branchId;
  const resolvedTerminalId = req.user.role === 'admin' ? terminalId : req.user.terminalId;

  const filters: string[] = [];
  const values: Array<number> = [];

  if (resolvedBranchId) {
    filters.push('v.branch_id = ?');
    values.push(resolvedBranchId);
  }

  if (resolvedTerminalId) {
    filters.push('v.terminal_id = ?');
    values.push(resolvedTerminalId);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT v.id, v.branch_id, b.name AS branch_name,
            v.terminal_id, t.name AS terminal_name,
            v.plate_number, v.internal_code, v.vehicle_type, v.capacity,
            v.operational_status, v.photo_url, v.notes, v.last_inspection_at, v.is_active
     FROM vehicles v
     JOIN branches b ON b.id = v.branch_id
     JOIN terminals t ON t.id = v.terminal_id
     ${whereClause}
     ORDER BY v.created_at DESC`,
    values,
  );

  const payload = (rows as Array<{
    id: number;
    branch_id: number;
    branch_name: string;
    terminal_id: number;
    terminal_name: string;
    plate_number: string;
    internal_code: string | null;
    vehicle_type: string;
    capacity: number;
    operational_status: 'active' | 'maintenance' | 'inactive';
    photo_url: string | null;
    notes: string | null;
    last_inspection_at: string | null;
    is_active: number;
  }>).map((item) => ({
    id: item.id.toString(),
    branchId: item.branch_id.toString(),
    branchName: item.branch_name,
    terminalId: item.terminal_id.toString(),
    terminalName: item.terminal_name,
    plateNumber: item.plate_number,
    internalCode: item.internal_code,
    vehicleType: item.vehicle_type,
    capacity: Number(item.capacity),
    operationalStatus: item.operational_status,
    photoUrl: item.photo_url,
    notes: item.notes,
    lastInspectionAt: item.last_inspection_at ? new Date(item.last_inspection_at).toISOString() : null,
    isActive: item.is_active === 1,
  }));

  res.json(payload);
});

operationsRouter.get('/operations/vehicle-issues', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'missing_user' });
    return;
  }

  const branchId = parseOptionalPositiveInt(req.query.branchId);
  const terminalId = parseOptionalPositiveInt(req.query.terminalId);
  const vehicleId = parseOptionalPositiveInt(req.query.vehicleId);
  const status = String(req.query.status ?? '').trim();

  if (req.user.role !== 'admin') {
    if ((branchId && branchId !== req.user.branchId) || (terminalId && terminalId !== req.user.terminalId)) {
      res.status(403).json({ message: 'invalid_scope' });
      return;
    }
  }

  const resolvedBranchId = req.user.role === 'admin' ? branchId : req.user.branchId;
  const resolvedTerminalId = req.user.role === 'admin' ? terminalId : req.user.terminalId;

  const filters: string[] = [];
  const values: Array<number | string> = [];

  if (resolvedBranchId) {
    filters.push('vir.branch_id = ?');
    values.push(resolvedBranchId);
  }

  if (resolvedTerminalId) {
    filters.push('vir.terminal_id = ?');
    values.push(resolvedTerminalId);
  }

  if (vehicleId) {
    filters.push('vir.vehicle_id = ?');
    values.push(vehicleId);
  }

  if (status.length > 0) {
    if (!['reported', 'in_repair', 'resolved'].includes(status)) {
      res.status(400).json({ message: 'invalid_issue_status' });
      return;
    }
    filters.push('vir.status = ?');
    values.push(status);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT vir.id, vir.vehicle_id, v.plate_number, v.internal_code, v.vehicle_type,
            vir.branch_id, b.name AS branch_name,
            vir.terminal_id, t.name AS terminal_name,
            vir.reported_by_user_id, u.email AS reported_by_email, COALESCE(u.full_name, u.email) AS reported_by_name,
            vir.severity, vir.issue_type, vir.description, vir.status, vir.reported_at, vir.updated_at, vir.resolved_at, vir.resolution_note
     FROM vehicle_issue_reports vir
     JOIN vehicles v ON v.id = vir.vehicle_id
     JOIN branches b ON b.id = vir.branch_id
     JOIN terminals t ON t.id = vir.terminal_id
     JOIN users u ON u.id = vir.reported_by_user_id
     ${whereClause}
     ORDER BY vir.updated_at DESC
     LIMIT 300`,
    values,
  );

  const payload = (rows as Array<{
    id: number;
    vehicle_id: number;
    plate_number: string;
    internal_code: string | null;
    vehicle_type: string;
    branch_id: number;
    branch_name: string;
    terminal_id: number;
    terminal_name: string;
    reported_by_user_id: number;
    reported_by_name: string;
    reported_by_email: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    issue_type: string;
    description: string;
    status: 'reported' | 'in_repair' | 'resolved';
    reported_at: string;
    updated_at: string;
    resolved_at: string | null;
    resolution_note: string | null;
  }>).map((item) => ({
    id: item.id.toString(),
    vehicleId: item.vehicle_id.toString(),
    vehiclePlateNumber: item.plate_number,
    vehicleInternalCode: item.internal_code,
    vehicleType: item.vehicle_type,
    branchId: item.branch_id.toString(),
    branchName: item.branch_name,
    terminalId: item.terminal_id.toString(),
    terminalName: item.terminal_name,
    reportedByUserId: item.reported_by_user_id.toString(),
    reportedByName: item.reported_by_name,
    reportedByEmail: item.reported_by_email,
    severity: item.severity,
    issueType: item.issue_type,
    description: item.description,
    status: item.status,
    reportedAt: new Date(item.reported_at).toISOString(),
    updatedAt: new Date(item.updated_at).toISOString(),
    resolvedAt: item.resolved_at ? new Date(item.resolved_at).toISOString() : null,
    resolutionNote: item.resolution_note,
  }));

  res.json(payload);
});

operationsRouter.post('/operations/vehicle-issues', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'missing_user' });
    return;
  }

  if (req.user.role === 'seller') {
    res.status(403).json({ message: 'driver_or_admin_required' });
    return;
  }

  const payload = req.body as {
    vehicleId?: number;
    severity?: 'low' | 'medium' | 'high' | 'critical';
    issueType?: string;
    description?: string;
  };

  const vehicleId = Number(payload.vehicleId ?? 0);
  const severity = payload.severity ?? 'medium';
  const issueType = String(payload.issueType ?? '').trim();
  const description = String(payload.description ?? '').trim();

  if (!Number.isInteger(vehicleId) || vehicleId <= 0) {
    res.status(400).json({ message: 'invalid_vehicle_id' });
    return;
  }

  if (!['low', 'medium', 'high', 'critical'].includes(severity)) {
    res.status(400).json({ message: 'invalid_issue_severity' });
    return;
  }

  if (issueType.length < 3 || issueType.length > 60) {
    res.status(400).json({ message: 'invalid_issue_type' });
    return;
  }

  if (description.length < 8 || description.length > 600) {
    res.status(400).json({ message: 'invalid_issue_description' });
    return;
  }

  const [vehicleRows] = await pool.query(
    `SELECT id, branch_id, terminal_id
     FROM vehicles
     WHERE id = ? AND is_active = 1
     LIMIT 1`,
    [vehicleId],
  );

  const vehicle = (vehicleRows as Array<{ id: number; branch_id: number; terminal_id: number }>)[0];
  if (!vehicle) {
    res.status(404).json({ message: 'vehicle_not_found' });
    return;
  }

  if (req.user.role !== 'admin' && (vehicle.branch_id !== req.user.branchId || vehicle.terminal_id !== req.user.terminalId)) {
    res.status(403).json({ message: 'invalid_scope' });
    return;
  }

  await pool.query(
    `INSERT INTO vehicle_issue_reports (
      vehicle_id, branch_id, terminal_id, reported_by_user_id,
      severity, issue_type, description, status, reported_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'reported', NOW())`,
    [vehicle.id, vehicle.branch_id, vehicle.terminal_id, req.user.id, severity, issueType, description],
  );

  await pool.query(
    `UPDATE vehicles
     SET operational_status = 'maintenance', is_active = 1
     WHERE id = ?`,
    [vehicle.id],
  );

  res.status(201).json({ ok: true });
});

operationsRouter.patch('/operations/vehicle-issues/:issueId/status', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'missing_user' });
    return;
  }

  if (req.user.role === 'seller') {
    res.status(403).json({ message: 'driver_or_admin_required' });
    return;
  }

  const issueId = Number.parseInt(req.params.issueId, 10);
  if (Number.isNaN(issueId)) {
    res.status(400).json({ message: 'invalid_issue_id' });
    return;
  }

  const payload = req.body as {
    status?: 'reported' | 'in_repair' | 'resolved';
    resolutionNote?: string;
  };

  const status = payload.status;
  const resolutionNote = String(payload.resolutionNote ?? '').trim();

  if (!status || !['reported', 'in_repair', 'resolved'].includes(status)) {
    res.status(400).json({ message: 'invalid_issue_status' });
    return;
  }

  if (resolutionNote.length > 600) {
    res.status(400).json({ message: 'invalid_resolution_note' });
    return;
  }

  const [issueRows] = await pool.query(
    `SELECT id, vehicle_id, reported_by_user_id, terminal_id
     FROM vehicle_issue_reports
     WHERE id = ?
     LIMIT 1`,
    [issueId],
  );

  const issue = (issueRows as Array<{ id: number; vehicle_id: number; reported_by_user_id: number; terminal_id: number }>)[0];
  if (!issue) {
    res.status(404).json({ message: 'issue_not_found' });
    return;
  }

  if (req.user.role !== 'admin' && issue.reported_by_user_id !== req.user.id) {
    res.status(403).json({ message: 'issue_owner_required' });
    return;
  }

  await pool.query(
    `UPDATE vehicle_issue_reports
     SET status = ?,
         resolution_note = ?,
         resolved_at = CASE WHEN ? = 'resolved' THEN NOW() ELSE NULL END
     WHERE id = ?`,
    [status, resolutionNote.length > 0 ? resolutionNote : null, status, issueId],
  );

  const vehicleStatus = status === 'resolved' ? 'active' : 'maintenance';
  await pool.query(
    `UPDATE vehicles
     SET operational_status = ?, is_active = 1
     WHERE id = ?`,
    [vehicleStatus, issue.vehicle_id],
  );

  res.json({ ok: true });
});

operationsRouter.post('/operations/vehicles', requireAuth, requireAdmin, async (req, res) => {
  const payload = req.body as {
    branchId?: number;
    terminalId?: number;
    plateNumber?: string;
    internalCode?: string;
    vehicleType?: string;
    capacity?: number;
    operationalStatus?: 'active' | 'maintenance' | 'inactive';
    photoUrl?: string;
    notes?: string;
    lastInspectionAt?: string;
  };

  const branchId = Number(payload.branchId ?? 0);
  const terminalId = Number(payload.terminalId ?? 0);
  const plateNumber = String(payload.plateNumber ?? '').trim().toUpperCase();
  const internalCode = String(payload.internalCode ?? '').trim().toUpperCase();
  const vehicleType = String(payload.vehicleType ?? 'autobus').trim();
  const capacity = Number(payload.capacity ?? 40);
  const operationalStatus = payload.operationalStatus ?? 'active';
  const photoUrl = String(payload.photoUrl ?? '').trim();
  const notes = String(payload.notes ?? '').trim();
  const lastInspectionAt = String(payload.lastInspectionAt ?? '').trim();

  if (!Number.isInteger(branchId) || branchId <= 0 || !Number.isInteger(terminalId) || terminalId <= 0) {
    res.status(400).json({ message: 'invalid_branch_terminal' });
    return;
  }

  if (plateNumber.length < 5 || plateNumber.length > 20) {
    res.status(400).json({ message: 'invalid_plate_number' });
    return;
  }

  if (!['sprinter', 'minibus', 'autobus', 'autobus_xl'].includes(vehicleType)) {
    res.status(400).json({ message: 'invalid_vehicle_type' });
    return;
  }

  if (!Number.isInteger(capacity) || capacity < 4 || capacity > 80) {
    res.status(400).json({ message: 'invalid_capacity' });
    return;
  }

  if (!['active', 'maintenance', 'inactive'].includes(operationalStatus)) {
    res.status(400).json({ message: 'invalid_operational_status' });
    return;
  }

  const [terminalRows] = await pool.query(
    'SELECT id FROM terminals WHERE id = ? AND branch_id = ? AND is_active = 1 LIMIT 1',
    [terminalId, branchId],
  );
  if ((terminalRows as Array<{ id: number }>).length === 0) {
    res.status(400).json({ message: 'invalid_branch_terminal' });
    return;
  }

  const normalizedInspectionAt = /^\d{4}-\d{2}-\d{2}/.test(lastInspectionAt) ? lastInspectionAt : null;

  try {
    await pool.query(
      `INSERT INTO vehicles (
         branch_id, terminal_id, plate_number, internal_code, vehicle_type, capacity,
         operational_status, photo_url, notes, last_inspection_at, is_active
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        branchId,
        terminalId,
        plateNumber,
        internalCode.length > 0 ? internalCode : null,
        vehicleType,
        capacity,
        operationalStatus,
        photoUrl.length > 0 ? photoUrl : null,
        notes.length > 0 ? notes : null,
        normalizedInspectionAt,
      ],
    );
    res.status(201).json({ ok: true });
  } catch (error) {
    const mysqlError = error as { code?: string };
    if (mysqlError.code === 'ER_DUP_ENTRY') {
      res.status(409).json({ message: 'vehicle_duplicate_identifier' });
      return;
    }
    console.error(error);
    res.status(500).json({ message: 'vehicle_create_failed' });
  }
});

operationsRouter.patch('/operations/vehicles/:vehicleId', requireAuth, requireAdmin, async (req, res) => {
  const vehicleId = Number.parseInt(req.params.vehicleId, 10);
  if (Number.isNaN(vehicleId)) {
    res.status(400).json({ message: 'invalid_vehicle_id' });
    return;
  }

  const payload = req.body as {
    operationalStatus?: 'active' | 'maintenance' | 'inactive';
    isActive?: boolean;
    notes?: string;
    photoUrl?: string;
    lastInspectionAt?: string | null;
  };

  const updates: string[] = [];
  const values: Array<string | number | null> = [];

  if (payload.operationalStatus !== undefined) {
    if (!['active', 'maintenance', 'inactive'].includes(payload.operationalStatus)) {
      res.status(400).json({ message: 'invalid_operational_status' });
      return;
    }
    updates.push('operational_status = ?');
    values.push(payload.operationalStatus);
  }

  if (payload.isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(payload.isActive ? 1 : 0);
  }

  if (payload.notes !== undefined) {
    const note = String(payload.notes).trim();
    updates.push('notes = ?');
    values.push(note.length > 0 ? note : null);
  }

  if (payload.photoUrl !== undefined) {
    const photoUrl = String(payload.photoUrl).trim();
    updates.push('photo_url = ?');
    values.push(photoUrl.length > 0 ? photoUrl : null);
  }

  if (payload.lastInspectionAt !== undefined) {
    const inspection = payload.lastInspectionAt ? String(payload.lastInspectionAt).trim() : '';
    const normalizedInspection = /^\d{4}-\d{2}-\d{2}/.test(inspection) ? inspection : null;
    updates.push('last_inspection_at = ?');
    values.push(normalizedInspection);
  }

  if (updates.length === 0) {
    res.status(400).json({ message: 'no_changes' });
    return;
  }

  values.push(vehicleId);
  await pool.query(`UPDATE vehicles SET ${updates.join(', ')} WHERE id = ?`, values);
  res.json({ ok: true });
});

operationsRouter.get('/operations/shifts/current', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'missing_user' });
    return;
  }

  const [rows] = await pool.query(
    `SELECT cs.id, cs.user_id, u.email AS user_email,
            cs.branch_id, b.name AS branch_name,
            cs.terminal_id, t.name AS terminal_name,
            cs.opening_cash, cs.opening_note, cs.expected_cash, cs.closing_cash, cs.difference_amount, cs.closing_note,
            cs.opened_at, cs.closed_at, cs.status
     FROM cashier_shifts cs
     JOIN users u ON u.id = cs.user_id
     JOIN branches b ON b.id = cs.branch_id
     JOIN terminals t ON t.id = cs.terminal_id
     WHERE cs.user_id = ? AND cs.status = 'open'
     ORDER BY cs.id DESC
     LIMIT 1`,
    [req.user.id],
  );

  const row = (rows as Array<{
    id: number;
    user_id: number;
    user_email: string;
    branch_id: number;
    branch_name: string;
    terminal_id: number;
    terminal_name: string;
    opening_cash: number;
    opening_note: string | null;
    expected_cash: number;
    closing_cash: number | null;
    difference_amount: number | null;
    closing_note: string | null;
    opened_at: string;
    closed_at: string | null;
    status: 'open' | 'closed';
  }>)[0];

  if (!row) {
    res.json(null);
    return;
  }

  res.json({
    id: row.id.toString(),
    userId: row.user_id.toString(),
    userEmail: row.user_email,
    branchId: row.branch_id.toString(),
    branchName: row.branch_name,
    terminalId: row.terminal_id.toString(),
    terminalName: row.terminal_name,
    openingCash: Number(row.opening_cash),
    openingNote: row.opening_note,
    expectedCash: Number(row.expected_cash),
    closingCash: row.closing_cash === null ? null : Number(row.closing_cash),
    difference: row.difference_amount === null ? null : Number(row.difference_amount),
    closingNote: row.closing_note,
    openedAt: new Date(row.opened_at).toISOString(),
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
    status: row.status,
  });
});

operationsRouter.post('/operations/shifts/open', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'missing_user' });
    return;
  }

  const openingCash = Number((req.body as { openingCash?: number }).openingCash ?? 0);
  const openingNote = String((req.body as { openingNote?: string }).openingNote ?? '').trim();
  if (!Number.isFinite(openingCash) || openingCash < 0) {
    res.status(400).json({ message: 'invalid_opening_cash' });
    return;
  }

  if (openingNote.length > 255) {
    res.status(400).json({ message: 'invalid_opening_note' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [scheduleRows] = await connection.query(
      `SELECT id
       FROM employee_schedules
       WHERE user_id = ?
         AND branch_id = ?
         AND terminal_id = ?
         AND day_of_week = WEEKDAY(NOW())
         AND is_active = 1
         AND TIME(NOW()) BETWEEN start_time AND end_time
       LIMIT 1`,
      [req.user.id, req.user.branchId, req.user.terminalId],
    );

    if ((scheduleRows as Array<{ id: number }>).length === 0 && req.user.role !== 'admin') {
      await connection.rollback();
      res.status(403).json({ message: 'shift_outside_schedule' });
      return;
    }

    const [existingRows] = await connection.query(
      `SELECT id FROM cashier_shifts WHERE user_id = ? AND status = 'open' LIMIT 1 FOR UPDATE`,
      [req.user.id],
    );
    if ((existingRows as Array<{ id: number }>).length > 0) {
      await connection.rollback();
      res.status(409).json({ message: 'shift_already_open' });
      return;
    }

    const [shiftInsert] = await connection.query(
      `INSERT INTO cashier_shifts (user_id, branch_id, terminal_id, opening_cash, opening_note, expected_cash, opened_at, status)
       VALUES (?, ?, ?, ?, ?, ?, NOW(), 'open')`,
      [req.user.id, req.user.branchId, req.user.terminalId, openingCash, openingNote.length > 0 ? openingNote : null, openingCash],
    );
    const shiftId = (shiftInsert as { insertId: number }).insertId;

    await connection.query(
      `INSERT INTO financial_events (
        shift_id, user_id, branch_id, terminal_id, event_type, amount, reference_type, reference_id, notes, metadata, created_at
      ) VALUES (?, ?, ?, ?, 'shift_open', ?, 'shift', ?, 'Apertura de turno', JSON_OBJECT('openingCash', ?), NOW())`,
      [shiftId, req.user.id, req.user.branchId, req.user.terminalId, openingCash, String(shiftId), openingCash],
    );

    await connection.commit();
    res.status(201).json({ ok: true, shiftId: String(shiftId) });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'shift_open_failed' });
  } finally {
    connection.release();
  }
});

operationsRouter.post('/operations/shifts/:shiftId/close', requireAuth, async (req: AuthRequest, res) => {
  if (!req.user) {
    res.status(401).json({ message: 'missing_user' });
    return;
  }

  const shiftId = Number.parseInt(req.params.shiftId, 10);
  const closingCash = Number((req.body as { closingCash?: number }).closingCash ?? NaN);
  const closingNote = String((req.body as { closingNote?: string }).closingNote ?? '').trim();

  if (Number.isNaN(shiftId) || !Number.isFinite(closingCash) || closingCash < 0) {
    res.status(400).json({ message: 'invalid_payload' });
    return;
  }

  if (closingNote.length > 255) {
    res.status(400).json({ message: 'invalid_closing_note' });
    return;
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [shiftRows] = await connection.query(
      `SELECT id, user_id, opening_cash, status
       FROM cashier_shifts
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [shiftId],
    );

    const shift = (shiftRows as Array<{ id: number; user_id: number; opening_cash: number; status: 'open' | 'closed' }>)[0];
    if (!shift) {
      await connection.rollback();
      res.status(404).json({ message: 'shift_not_found' });
      return;
    }

    if (shift.user_id !== req.user.id && req.user.role !== 'admin') {
      await connection.rollback();
      res.status(403).json({ message: 'shift_owner_required' });
      return;
    }

    if (shift.status !== 'open') {
      await connection.rollback();
      res.status(409).json({ message: 'shift_already_closed' });
      return;
    }

    const [sumRows] = await connection.query(
      `SELECT COALESCE(SUM(amount), 0) AS amount
       FROM financial_events
       WHERE shift_id = ?`,
      [shiftId],
    );
    const movementTotal = Number((sumRows as Array<{ amount: number }>)[0]?.amount ?? 0);
    const expectedCash = Number(shift.opening_cash) + movementTotal;
    const difference = closingCash - expectedCash;

    await connection.query(
      `UPDATE cashier_shifts
       SET expected_cash = ?, closing_cash = ?, difference_amount = ?, closing_note = ?, closed_at = NOW(), status = 'closed'
       WHERE id = ?`,
      [expectedCash, closingCash, difference, closingNote.length > 0 ? closingNote : null, shiftId],
    );

    await connection.query(
      `INSERT INTO financial_events (
        shift_id, user_id, branch_id, terminal_id, event_type, amount, reference_type, reference_id, notes, metadata, created_at
      ) VALUES (?, ?, ?, ?, 'shift_close', ?, 'shift', ?, 'Cierre de turno', JSON_OBJECT('expectedCash', ?, 'closingCash', ?, 'difference', ?), NOW())`,
      [shiftId, req.user.id, req.user.branchId, req.user.terminalId, 0, String(shiftId), expectedCash, closingCash, difference],
    );

    await connection.commit();
    res.json({ ok: true, expectedCash, difference });
  } catch (error) {
    await connection.rollback();
    console.error(error);
    res.status(500).json({ message: 'shift_close_failed' });
  } finally {
    connection.release();
  }
});

operationsRouter.get('/operations/shifts', requireAuth, requireAdmin, async (req, res) => {
  const branchId = parseOptionalPositiveInt(req.query.branchId);
  const terminalId = parseOptionalPositiveInt(req.query.terminalId);

  const filters: string[] = [];
  const values: Array<number> = [];

  if (branchId) {
    filters.push('cs.branch_id = ?');
    values.push(branchId);
  }

  if (terminalId) {
    filters.push('cs.terminal_id = ?');
    values.push(terminalId);
  }

  const whereClause = filters.length > 0 ? `WHERE ${filters.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT cs.id, cs.user_id, u.email AS user_email,
            cs.branch_id, b.name AS branch_name,
            cs.terminal_id, t.name AS terminal_name,
            cs.opening_cash, cs.opening_note, cs.expected_cash, cs.closing_cash, cs.difference_amount, cs.closing_note,
            cs.opened_at, cs.closed_at, cs.status
     FROM cashier_shifts cs
     JOIN users u ON u.id = cs.user_id
     JOIN branches b ON b.id = cs.branch_id
     JOIN terminals t ON t.id = cs.terminal_id
     ${whereClause}
     ORDER BY cs.opened_at DESC
     LIMIT 50`,
    values,
  );

  const result = (rows as Array<{
    id: number;
    user_id: number;
    user_email: string;
    branch_id: number;
    branch_name: string;
    terminal_id: number;
    terminal_name: string;
    opening_cash: number;
    opening_note: string | null;
    expected_cash: number;
    closing_cash: number | null;
    difference_amount: number | null;
    closing_note: string | null;
    opened_at: string;
    closed_at: string | null;
    status: 'open' | 'closed';
  }>).map((row) => ({
    id: row.id.toString(),
    userId: row.user_id.toString(),
    userEmail: row.user_email,
    branchId: row.branch_id.toString(),
    branchName: row.branch_name,
    terminalId: row.terminal_id.toString(),
    terminalName: row.terminal_name,
    openingCash: Number(row.opening_cash),
    openingNote: row.opening_note,
    expectedCash: Number(row.expected_cash),
    closingCash: row.closing_cash === null ? null : Number(row.closing_cash),
    difference: row.difference_amount === null ? null : Number(row.difference_amount),
    closingNote: row.closing_note,
    openedAt: new Date(row.opened_at).toISOString(),
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
    status: row.status,
  }));

  res.json(result);
});

operationsRouter.get('/operations/schedules', requireAuth, requireAdmin, async (req, res) => {
  const userId = parseOptionalPositiveInt(req.query.userId);
  const whereClause = userId ? 'WHERE es.user_id = ?' : '';
  const values = userId ? [userId] : [];

  const [rows] = await pool.query(
    `SELECT es.id, es.user_id, es.branch_id, es.terminal_id, es.day_of_week, es.start_time, es.end_time, es.notes, es.is_active,
            u.full_name, u.email, b.name AS branch_name, t.name AS terminal_name
     FROM employee_schedules es
     JOIN users u ON u.id = es.user_id
     JOIN branches b ON b.id = es.branch_id
     JOIN terminals t ON t.id = es.terminal_id
     ${whereClause}
     ORDER BY es.day_of_week ASC, es.start_time ASC`,
    values,
  );

  const payload = (rows as Array<{
    id: number;
    user_id: number;
    branch_id: number;
    terminal_id: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
    notes: string | null;
    is_active: number;
    full_name: string | null;
    email: string;
    branch_name: string;
    terminal_name: string;
  }>).map((item) => ({
    id: item.id.toString(),
    userId: item.user_id.toString(),
    employeeName: item.full_name ?? item.email,
    branchId: item.branch_id.toString(),
    branchName: item.branch_name,
    terminalId: item.terminal_id.toString(),
    terminalName: item.terminal_name,
    dayOfWeek: item.day_of_week,
    startTime: item.start_time.slice(0, 5),
    endTime: item.end_time.slice(0, 5),
    notes: item.notes,
    isActive: item.is_active === 1,
  }));

  res.json(payload);
});

operationsRouter.post('/operations/schedules', requireAuth, requireAdmin, async (req, res) => {
  const payload = req.body as {
    userId?: number;
    branchId?: number;
    terminalId?: number;
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    notes?: string;
    isActive?: boolean;
  };

  const userId = Number(payload.userId ?? 0);
  const branchId = Number(payload.branchId ?? 0);
  const terminalId = Number(payload.terminalId ?? 0);
  const dayOfWeek = Number(payload.dayOfWeek ?? -1);
  const startTime = String(payload.startTime ?? '').trim();
  const endTime = String(payload.endTime ?? '').trim();
  const notes = String(payload.notes ?? '').trim();
  const isActive = payload.isActive !== false;

  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(branchId) || branchId <= 0 || !Number.isInteger(terminalId) || terminalId <= 0) {
    res.status(400).json({ message: 'invalid_user_branch_terminal' });
    return;
  }

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    res.status(400).json({ message: 'invalid_day_of_week' });
    return;
  }

  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) {
    res.status(400).json({ message: 'invalid_schedule_time' });
    return;
  }

  const [terminalRows] = await pool.query(
    'SELECT id FROM terminals WHERE id = ? AND branch_id = ? AND is_active = 1 LIMIT 1',
    [terminalId, branchId],
  );
  if ((terminalRows as Array<{ id: number }>).length === 0) {
    res.status(400).json({ message: 'invalid_branch_terminal' });
    return;
  }

  await pool.query(
    `INSERT INTO employee_schedules (user_id, branch_id, terminal_id, day_of_week, start_time, end_time, notes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, branchId, terminalId, dayOfWeek, startTime, endTime, notes.length > 0 ? notes : null, isActive ? 1 : 0],
  );

  res.status(201).json({ ok: true });
});

operationsRouter.patch('/operations/schedules/:scheduleId', requireAuth, requireAdmin, async (req, res) => {
  const scheduleId = Number.parseInt(req.params.scheduleId, 10);
  if (Number.isNaN(scheduleId)) {
    res.status(400).json({ message: 'invalid_schedule_id' });
    return;
  }

  const payload = req.body as {
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    notes?: string;
    isActive?: boolean;
  };

  const updates: string[] = [];
  const values: Array<string | number> = [];

  if (payload.dayOfWeek !== undefined) {
    const dayOfWeek = Number(payload.dayOfWeek);
    if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
      res.status(400).json({ message: 'invalid_day_of_week' });
      return;
    }
    updates.push('day_of_week = ?');
    values.push(dayOfWeek);
  }

  if (payload.startTime !== undefined || payload.endTime !== undefined) {
    const startTime = String(payload.startTime ?? '').trim();
    const endTime = String(payload.endTime ?? '').trim();
    if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime) || startTime >= endTime) {
      res.status(400).json({ message: 'invalid_schedule_time' });
      return;
    }
    updates.push('start_time = ?', 'end_time = ?');
    values.push(startTime, endTime);
  }

  if (payload.notes !== undefined) {
    const notes = String(payload.notes).trim();
    updates.push('notes = ?');
    values.push(notes.length > 0 ? notes : null);
  }

  if (payload.isActive !== undefined) {
    updates.push('is_active = ?');
    values.push(payload.isActive ? 1 : 0);
  }

  if (updates.length === 0) {
    res.status(400).json({ message: 'no_changes' });
    return;
  }

  values.push(scheduleId);
  await pool.query(`UPDATE employee_schedules SET ${updates.join(', ')} WHERE id = ?`, values);

  res.json({ ok: true });
});

operationsRouter.delete('/operations/schedules/:scheduleId', requireAuth, requireAdmin, async (req, res) => {
  const scheduleId = Number.parseInt(req.params.scheduleId, 10);
  if (Number.isNaN(scheduleId)) {
    res.status(400).json({ message: 'invalid_schedule_id' });
    return;
  }

  await pool.query('DELETE FROM employee_schedules WHERE id = ?', [scheduleId]);
  res.status(204).send();
});

operationsRouter.get('/operations/ledger', requireAuth, requireAdmin, async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT fe.id, fe.event_type, fe.amount, fe.reference_type, fe.reference_id, fe.notes, fe.created_at,
            u.email AS user_email, b.name AS branch_name, t.name AS terminal_name
     FROM financial_events fe
     JOIN users u ON u.id = fe.user_id
     JOIN branches b ON b.id = fe.branch_id
     JOIN terminals t ON t.id = fe.terminal_id
     ORDER BY fe.created_at DESC
     LIMIT 200`,
  );

  const payload = (rows as Array<{
    id: number;
    event_type: string;
    amount: number;
    reference_type: string;
    reference_id: string | null;
    notes: string | null;
    created_at: string;
    user_email: string;
    branch_name: string;
    terminal_name: string;
  }>).map((row) => ({
    id: row.id.toString(),
    eventType: row.event_type,
    amount: Number(row.amount),
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    notes: row.notes,
    userEmail: row.user_email,
    branchName: row.branch_name,
    terminalName: row.terminal_name,
    createdAt: new Date(row.created_at).toISOString(),
  }));

  res.json(payload);
});

operationsRouter.get('/operations/kpi', requireAuth, requireAdmin, async (req, res) => {
  const branchId = parseOptionalPositiveInt(req.query.branchId);
  const terminalId = parseOptionalPositiveInt(req.query.terminalId);

  const eventFilters: string[] = [];
  const eventValues: Array<number> = [];
  const ticketFilters: string[] = [];
  const ticketValues: Array<number> = [];

  if (branchId) {
    eventFilters.push('branch_id = ?');
    eventValues.push(branchId);
    ticketFilters.push('branch_id = ?');
    ticketValues.push(branchId);
  }

  if (terminalId) {
    eventFilters.push('terminal_id = ?');
    eventValues.push(terminalId);
    ticketFilters.push('terminal_id = ?');
    ticketValues.push(terminalId);
  }

  const eventWhereClause = eventFilters.length > 0 ? ` AND ${eventFilters.join(' AND ')}` : '';
  const ticketWhereClause = ticketFilters.length > 0 ? ` AND ${ticketFilters.join(' AND ')}` : '';

  const [rows] = await pool.query(
    `SELECT
      COALESCE(SUM(CASE WHEN event_type = 'ticket_sale' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN amount ELSE 0 END), 0) AS revenue_month,
      COALESCE(SUM(CASE WHEN event_type = 'ticket_cancel' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN ABS(amount) ELSE 0 END), 0) AS cancel_loss_month,
      COALESCE(SUM(CASE WHEN event_type = 'expense' AND created_at >= DATE_FORMAT(NOW(), '%Y-%m-01') THEN ABS(amount) ELSE 0 END), 0) AS expenses_month
     FROM financial_events
     WHERE 1=1${eventWhereClause}`,
    eventValues,
  );

  const [discountRows] = await pool.query(
    `SELECT COALESCE(SUM(base_price - price), 0) AS discounts_month
     FROM tickets
     WHERE status <> 'cancelled' AND sold_at >= DATE_FORMAT(NOW(), '%Y-%m-01')${ticketWhereClause}`,
    ticketValues,
  );

  const data = (rows as Array<{ revenue_month: number; cancel_loss_month: number; expenses_month: number }>)[0];
  const discountData = (discountRows as Array<{ discounts_month: number }>)[0];

  const revenueMonth = Number(data?.revenue_month ?? 0);
  const discountsMonth = Number(discountData?.discounts_month ?? 0);
  const cancelLossMonth = Number(data?.cancel_loss_month ?? 0);
  const expensesMonth = Number(data?.expenses_month ?? 0);
  const netUtilityMonth = revenueMonth - discountsMonth - cancelLossMonth - expensesMonth;

  res.json({
    revenueMonth,
    discountsMonth,
    cancelLossMonth,
    expensesMonth,
    netUtilityMonth,
  });
});

operationsRouter.get('/operations/health', requireAuth, requireAdmin, async (_req, res) => {
  const [dbRows] = await pool.query('SELECT 1 AS ok');
  const dbOk = (dbRows as Array<{ ok: number }>)[0]?.ok === 1;

  res.json({
    status: dbOk ? 'ok' : 'degraded',
    dbOk,
    ...getObservabilitySnapshot(),
  });
});

export default operationsRouter;
