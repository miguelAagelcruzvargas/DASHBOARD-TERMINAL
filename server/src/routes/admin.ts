import { Router } from 'express';

const adminRouter = Router();

adminRouter.post('/admin/unlock', (req, res) => {
  const { password, isAdminByEmail } = req.body as {
    password?: string;
    isAdminByEmail?: boolean;
  };

  const adminPassword = process.env.ADMIN_GATE_PASSWORD ?? 'AU-ADMIN-2026';

  if (isAdminByEmail || password === adminPassword) {
    res.json({ ok: true });
    return;
  }

  res.status(401).json({ ok: false, message: 'invalid_credentials' });
});

export default adminRouter;
