import { Router } from 'express';
import pool from '../lib/db';
import { requireAdmin, requireAuth, type AuthRequest } from '../lib/auth';

const expensesRouter = Router();

type ExpenseCategory = 'fixed' | 'variable' | 'payroll';
type ExpensePaymentMethod = 'cash' | 'transfer' | 'card' | 'other';

const VALID_CATEGORIES: ExpenseCategory[] = ['fixed', 'variable', 'payroll'];
const VALID_PAYMENT_METHODS: ExpensePaymentMethod[] = ['cash', 'transfer', 'card', 'other'];

expensesRouter.get('/expenses', requireAuth, requireAdmin, async (_req, res) => {
  const [rows] = await pool.query(
    `SELECT e.id, e.category, e.title, e.description, e.amount, e.expense_date, e.payment_method, e.notes,
            e.created_by, e.created_at, u.email AS created_by_email
     FROM expenses e
     JOIN users u ON u.id = e.created_by
     ORDER BY e.expense_date DESC, e.id DESC`,
  );

  const result = (rows as Array<{
    id: number;
    category: ExpenseCategory;
    title: string;
    description: string | null;
    amount: number;
    expense_date: string;
    payment_method: ExpensePaymentMethod;
    notes: string | null;
    created_by: number;
    created_at: string;
    created_by_email: string;
  }>).map((item) => ({
    id: item.id.toString(),
    category: item.category,
    title: item.title,
    description: item.description ?? '',
    amount: Number(item.amount),
    expenseDate: new Date(item.expense_date).toISOString(),
    paymentMethod: item.payment_method,
    notes: item.notes ?? '',
    createdBy: item.created_by.toString(),
    createdByEmail: item.created_by_email,
    createdAt: new Date(item.created_at).toISOString(),
  }));

  res.json(result);
});

expensesRouter.post('/expenses', requireAuth, requireAdmin, async (req: AuthRequest, res) => {
  const { category, title, description, amount, expenseDate, paymentMethod, notes } = req.body as {
    category?: ExpenseCategory;
    title?: string;
    description?: string;
    amount?: number;
    expenseDate?: string;
    paymentMethod?: ExpensePaymentMethod;
    notes?: string;
  };

  if (!req.user) {
    res.status(401).json({ message: 'missing_user' });
    return;
  }

  if (!category || !VALID_CATEGORIES.includes(category)) {
    res.status(400).json({ message: 'invalid_expense_category' });
    return;
  }

  const normalizedTitle = (title ?? '').trim();
  if (normalizedTitle.length < 3) {
    res.status(400).json({ message: 'invalid_expense_title' });
    return;
  }

  const normalizedAmount = Number(amount);
  if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
    res.status(400).json({ message: 'invalid_expense_amount' });
    return;
  }

  const normalizedExpenseDate = expenseDate ? new Date(expenseDate) : new Date();
  if (Number.isNaN(normalizedExpenseDate.getTime())) {
    res.status(400).json({ message: 'invalid_expense_date' });
    return;
  }

  const normalizedPaymentMethod = paymentMethod && VALID_PAYMENT_METHODS.includes(paymentMethod)
    ? paymentMethod
    : 'cash';

  const normalizedDescription = (description ?? '').trim();
  const normalizedNotes = (notes ?? '').trim();

  const [result] = await pool.query(
    `INSERT INTO expenses (category, title, description, amount, expense_date, payment_method, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      category,
      normalizedTitle,
      normalizedDescription || null,
      normalizedAmount,
      normalizedExpenseDate,
      normalizedPaymentMethod,
      normalizedNotes || null,
      req.user.id,
    ],
  );

  res.status(201).json({ ok: true, id: String((result as { insertId: number }).insertId) });
});

expensesRouter.delete('/expenses/:expenseId', requireAuth, requireAdmin, async (req, res) => {
  const expenseId = Number.parseInt(req.params.expenseId, 10);
  if (Number.isNaN(expenseId)) {
    res.status(400).json({ message: 'invalid_expense_id' });
    return;
  }

  await pool.query('DELETE FROM expenses WHERE id = ?', [expenseId]);
  res.json({ ok: true });
});

export default expensesRouter;