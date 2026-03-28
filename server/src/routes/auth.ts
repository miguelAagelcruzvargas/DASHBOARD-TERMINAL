import { Router } from 'express';
import pool from '../lib/db';
import { requireAdmin, requireAuth, type AuthRequest, signAuthToken } from '../lib/auth';
import { hashPassword, verifyPassword } from '../lib/password';

const authRouter = Router();

authRouter.post('/auth/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ message: 'email_password_required' });
    return;
  }

  const [rows] = await pool.query(
    'SELECT id, email, password_hash, role, is_active FROM users WHERE email = ? LIMIT 1',
    [email.toLowerCase().trim()],
  );

  const users = rows as Array<{
    id: number;
    email: string;
    password_hash: string;
    role: 'admin' | 'seller';
    is_active: number;
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

  const token = signAuthToken({ id: user.id, email: user.email, role: user.role });
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
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
  const { email, password, role } = req.body as {
    email?: string;
    password?: string;
    role?: 'admin' | 'seller';
  };

  if (!email || !password || password.length < 10 || (role !== 'admin' && role !== 'seller')) {
    res.status(400).json({ message: 'invalid_payload' });
    return;
  }

  const normalizedEmail = email.toLowerCase().trim();
  const [existingRows] = await pool.query('SELECT id FROM users WHERE email = ? LIMIT 1', [normalizedEmail]);
  if ((existingRows as Array<{ id: number }>).length > 0) {
    res.status(409).json({ message: 'user_already_exists' });
    return;
  }

  const passwordHash = await hashPassword(password);
  await pool.query('INSERT INTO users (email, password_hash, role, is_active) VALUES (?, ?, ?, 1)', [
    normalizedEmail,
    passwordHash,
    role,
  ]);

  res.status(201).json({ ok: true });
});

export default authRouter;
