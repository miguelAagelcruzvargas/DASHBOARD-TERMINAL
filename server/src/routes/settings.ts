import { Router } from 'express';
import { requireAdmin, requireAuth } from '../lib/auth';
import { getDiscountConfig, sanitizeDiscountConfig, updateDiscountConfig } from '../lib/discountConfig';

const settingsRouter = Router();

settingsRouter.get('/settings/discounts', requireAuth, async (_req, res) => {
  try {
    const config = await getDiscountConfig();
    res.json(config);
  } catch (_error) {
    res.status(500).json({ message: 'settings_read_failed' });
  }
});

settingsRouter.put('/settings/discounts', requireAuth, requireAdmin, async (req, res) => {
  try {
    const next = sanitizeDiscountConfig(req.body ?? {});

    if (next.childEnabled && next.seniorEnabled && next.childMaxAge >= next.seniorMinAge) {
      res.status(400).json({ message: 'invalid_discount_ranges' });
      return;
    }

    await updateDiscountConfig(next);
    res.json({ ok: true, config: next });
  } catch (_error) {
    res.status(500).json({ message: 'settings_update_failed' });
  }
});

export default settingsRouter;
