import { Router } from 'express';
import crypto from 'node:crypto';
import pool from '../lib/db';
import { requireAdmin, requireAuth, type AuthRequest, signAuthToken } from '../lib/auth';
import { hashPassword, verifyPassword } from '../lib/password';

const authRouter = Router();

function normalizeNameForUserKey(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24);
}

function buildGeneratedPassword(length = 12): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$!%*?&';
  const random = crypto.randomBytes(length);
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += charset[random[index] % charset.length];
  }
  return output;
}

async function buildUniqueDriverEmail(fullName: string): Promise<string> {
  const base = normalizeNameForUserKey(fullName) || 'chofer';

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const suffix = crypto.randomBytes(3).toString('hex');
    const candidate = `${base}.${suffix}@chofer.terminal-au.local`;
    const [rows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [candidate]);
    if ((rows as Array<{ id: number }>).length === 0) {
      return candidate;
    }
  }

  return `chofer.${Date.now()}@chofer.terminal-au.local`;
}

authRouter.post('/auth/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ message: 'email_password_required' });
    return;
  }

  const [rows] = await pool.query(
    'SELECT id, email, full_name, password_hash, role, is_active, branch_id, terminal_id FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()],
  );

  const users = rows as Array<{
    id: number;
    email: string;
    full_name: string | null;
    password_hash: string;
    role: 'admin' | 'seller' | 'driver';
    is_active: number;
    branch_id: number | null;
    terminal_id: number | null;
  }>;

  const user = users[0];
  if (!user || user.is_active !== 1) {
    res.status(401).json({ message: 'invalid_credentials' });
    return;
  }

  const matches = await verifyPassword(password, user.password_hash);
  if (!matches) {
    res.status(401).json({ message: 'invalid_credentials' });
    return;
  }

  const branchId = user.branch_id ?? 1;
  const terminalId = user.terminal_id ?? 1;

  const token = signAuthToken({ id: user.id, email: user.email, role: user.role, branchId, terminalId });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.full_name ?? user.email,
      role: user.role,
      branchId,
      terminalId,
    },
  });
});

authRouter.get('/auth/me', requireAuth, async (req: AuthRequest, res) => {
  res.json({ user: req.user });
});

authRouter.post('/auth/bootstrap-admin', async (req, res) => {
  const { setupKey, email, password } = req.body as {
    setupKey?: string;
    email?: string;
    password?: string;
  };

  if (!setupKey || setupKey !== (process.env.ADMIN_SETUP_KEY ?? 'CHANGE_THIS_KEY')) {
    res.status(403).json({ message: 'invalid_setup_key' });
    return;
  }

  if (!email || !password || password.length < 10) {
    res.status(400).json({ message: 'invalid_payload' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();

  const [existsRows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
  const exists = (existsRows as Array<{ id: number }>)[0];
  if (exists) {
    res.status(409).json({ message: 'user_already_exists' });
    return;
  }

  const passwordHash = await hashPassword(password);
  await pool.query(
    'INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, ?, 1)',
    [normalizedEmail, passwordHash, 'admin'],
  );

  res.status(201).json({ ok: true });
});

authRouter.post('/auth/reauth', requireAuth, async (req: AuthRequest, res) => {
  const { password } = req.body as { password?: string };

  if (!password || !req.user) {
    res.status(400).json({ message: 'password_required' });
    return;
  }

  const [rows] = await pool.query('SELECT password_hash FROM users WHERE id = ? LIMIT 1', [req.user.id]);
  const data = rows as Array<{ password_hash: string }>;
  const user = data[0];
  if (!user) {
    res.status(404).json({ message: 'user_not_found' });
    return;
  }

  const matches = await verifyPassword(password, user.password_hash);
  if (!matches) {
    res.status(401).json({ message: 'invalid_credentials' });
    return;
  }

  res.json({ ok: true });
});

authRouter.post('/auth/users', requireAuth, requireAdmin, async (req, res) => {
  const { email, fullName, password, role, branchId, terminalId, autoGenerateCredentials } = req.body as {
    email?: string;
    fullName?: string;
    password?: string;
    role?: 'admin' | 'seller' | 'driver';
    branchId?: number;
    terminalId?: number;
    autoGenerateCredentials?: boolean;
  };

  if (role !== 'admin' && role !== 'seller' && role !== 'driver') {
    res.status(400).json({ message: 'invalid_payload' });
    return;
  }

  const safeBranchId = Number(branchId ?? 0);
  const safeTerminalId = Number(terminalId ?? 0);
  if (!Number.isInteger(safeBranchId) || safeBranchId <= 0 || !Number.isInteger(safeTerminalId) || safeTerminalId <= 0) {
    res.status(400).json({ message: 'invalid_branch_terminal' });
    return;
  }

  const normalizedFullName = (fullName ?? '').trim();
  const shouldAutoGenerate = role === 'driver' && autoGenerateCredentials === true;

  if (normalizedFullName.length < 3) {
    res.status(400).json({ message: 'invalid_full_name' });
    return;
  }

  let normalizedEmail = '';
  let plainPassword = '';

  if (shouldAutoGenerate) {
    normalizedEmail = await buildUniqueDriverEmail(normalizedFullName);
    plainPassword = buildGeneratedPassword(12);
  } else {
    const providedEmail = (email ?? '').toLowerCase().trim();
    if (!providedEmail || providedEmail.length < 6) {
      res.status(400).json({ message: 'invalid_email' });
      return;
    }

    if (!password || password.length < 10) {
      res.status(400).json({ message: 'invalid_password' });
      return;
    }

    normalizedEmail = providedEmail;
    plainPassword = password;
  }

  const [existingRows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
  if ((existingRows as Array<{ id: number }>).length > 0) {
    res.status(409).json({ message: 'user_already_exists' });
    return;
  }

  const [terminalRows] = await pool.query(
    'SELECT id FROM terminals WHERE id = ? AND branch_id = ? AND is_active = 1 LIMIT 1',
    [safeTerminalId, safeBranchId],
  );
  if ((terminalRows as Array<{ id: number }>).length === 0) {
    res.status(400).json({ message: 'invalid_branch_terminal' });
    return;
  }

  const passwordHash = await hashPassword(plainPassword);
  await pool.query('INSERT INTO users (email, full_name, password_hash, role, branch_id, terminal_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)', [
    normalizedEmail,
    normalizedFullName,
    passwordHash,
    role,
    safeBranchId,
    safeTerminalId,
  ]);

  res.status(201).json({
    ok: true,
    generatedCredentials: shouldAutoGenerate
      ? {
          email: normalizedEmail,
          password: plainPassword,
        }
      : null,
  });
});

authRouter.get('/auth/users', requireAuth, requireAdmin, async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.is_active, u.branch_id, u.terminal_id,
            b.name AS branch_name, t.name AS terminal_name
     FROM users u
     LEFT JOIN branches b ON b.id = u.branch_id
     LEFT JOIN terminals t ON t.id = u.terminal_id
     ORDER BY u.role DESC, u.full_name ASC, u.email ASC`,
  );

  const payload = (rows as Array<{
    id: number;
    email: string;
    full_name: string | null;
    role: 'admin' | 'seller' | 'driver';
    is_active: number;
    branch_id: number | null;
    terminal_id: number | null;
    branch_name: string | null;
    terminal_name: string | null;
  }>).map((item) => ({
    id: item.id.toString(),
    email: item.email,
    fullName: item.full_name ?? item.email,
    role: item.role,
    isActive: item.is_active === 1,
    branchId: item.branch_id?.toString() ?? '',
    terminalId: item.terminal_id?.toString() ?? '',
    branchName: item.branch_name ?? '-',
    terminalName: item.terminal_name ?? '-',
  }));

  res.json(payload);
});

authRouter.patch('/auth/users/:userId', requireAuth, requireAdmin, async (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);
  if (Number.isNaN(userId)) {
    res.status(400).json({ message: 'invalid_user_id' });
    return;
  }

  const { fullName, role, isActive, branchId, terminalId, password } = req.body as {
    fullName?: string;
    role?: 'admin' | 'seller' | 'driver';
    isActive?: boolean;
    branchId?: number;
    terminalId?: number;
    password?: string;
  };

  const updates: string[] = [];
  const values: Array<string | number> = [];

  if (typeof fullName === 'string') {
    const normalized = fullName.trim();
    if (normalized.length < 3) {
      res.status(400).json({ message: 'invalid_full_name' });
      return;
    }
    updates.push('full_name = ?');
    values.push(normalized);
  }

  if (role === 'admin' || role === 'seller' || role === 'driver') {
    updates.push('role = ?');
    values.push(role);
  }

  if (typeof isActive === 'boolean') {
    updates.push('is_active = ?');
    values.push(isActive ? 1 : 0);
  }

  if (branchId !== undefined || terminalId !== undefined) {
    const safeBranchId = Number(branchId ?? 0);
    const safeTerminalId = Number(terminalId ?? 0);
    if (!Number.isInteger(safeBranchId) || safeBranchId <= 0 || !Number.isInteger(safeTerminalId) || safeTerminalId <= 0) {
      res.status(400).json({ message: 'invalid_branch_terminal' });
      return;
    }

    const [terminalRows] = await pool.query(
      'SELECT id FROM terminals WHERE id = ? AND branch_id = ? AND is_active = 1 LIMIT 1',
      [safeTerminalId, safeBranchId],
    );
    if ((terminalRows as Array<{ id: number }>).length === 0) {
      res.status(400).json({ message: 'invalid_branch_terminal' });
      return;
    }

    updates.push('branch_id = ?', 'terminal_id = ?');
    values.push(safeBranchId, safeTerminalId);
  }

  if (typeof password === 'string' && password.trim().length > 0) {
    if (password.length < 10) {
      res.status(400).json({ message: 'invalid_password' });
      return;
    }
    const passwordHash = await hashPassword(password);
    updates.push('password_hash = ?');
    values.push(passwordHash);
  }

  if (updates.length === 0) {
    res.status(400).json({ message: 'no_changes' });
    return;
  }

  values.push(userId);
  await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

  res.json({ ok: true });
});

export default authRouter;
