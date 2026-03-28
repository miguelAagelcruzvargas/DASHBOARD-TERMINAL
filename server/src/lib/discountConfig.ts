import pool from './db';

export type DiscountConfig = {
  childMaxAge: number;
  childPercent: number;
  seniorMinAge: number;
  seniorPercent: number;
  childEnabled: boolean;
  seniorEnabled: boolean;
  disabilityEnabled: boolean;
  disabilityPercent: number;
};

export const DEFAULT_DISCOUNT_CONFIG: DiscountConfig = {
  childMaxAge: 11,
  childPercent: 50,
  seniorMinAge: 60,
  seniorPercent: 30,
  childEnabled: true,
  seniorEnabled: true,
  disabilityEnabled: true,
  disabilityPercent: 40,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeDiscountConfig(input: Partial<DiscountConfig>): DiscountConfig {
  const childMaxAge = clamp(Math.trunc(Number(input.childMaxAge ?? DEFAULT_DISCOUNT_CONFIG.childMaxAge)), 0, 17);
  const seniorMinAge = clamp(Math.trunc(Number(input.seniorMinAge ?? DEFAULT_DISCOUNT_CONFIG.seniorMinAge)), 50, 120);
  const childPercent = clamp(Number(input.childPercent ?? DEFAULT_DISCOUNT_CONFIG.childPercent), 0, 100);
  const seniorPercent = clamp(Number(input.seniorPercent ?? DEFAULT_DISCOUNT_CONFIG.seniorPercent), 0, 100);
  const disabilityPercent = clamp(Number(input.disabilityPercent ?? DEFAULT_DISCOUNT_CONFIG.disabilityPercent), 0, 100);

  return {
    childMaxAge,
    childPercent,
    seniorMinAge,
    seniorPercent,
    childEnabled: Boolean(input.childEnabled ?? DEFAULT_DISCOUNT_CONFIG.childEnabled),
    seniorEnabled: Boolean(input.seniorEnabled ?? DEFAULT_DISCOUNT_CONFIG.seniorEnabled),
    disabilityEnabled: Boolean(input.disabilityEnabled ?? DEFAULT_DISCOUNT_CONFIG.disabilityEnabled),
    disabilityPercent,
  };
}

export async function getDiscountConfig(): Promise<DiscountConfig> {
  try {
    const [rows] = await pool.query(
      'SELECT CAST(setting_value AS CHAR) AS setting_value FROM app_settings WHERE setting_key = ? LIMIT 1',
      ['discount_rules'],
    );

    const row = (rows as Array<{ setting_value: string }>)[0];
    if (!row || !row.setting_value) return DEFAULT_DISCOUNT_CONFIG;

    const parsed = JSON.parse(row.setting_value) as Partial<DiscountConfig>;
    return sanitizeDiscountConfig(parsed);
  } catch (_error) {
    return DEFAULT_DISCOUNT_CONFIG;
  }
}

export async function updateDiscountConfig(config: DiscountConfig): Promise<void> {
  await pool.query(
    `UPDATE app_settings
     SET setting_value = JSON_OBJECT(
      'childMaxAge', ?,
      'childPercent', ?,
      'seniorMinAge', ?,
      'seniorPercent', ?,
      'childEnabled', ?,
      'seniorEnabled', ?,
      'disabilityEnabled', ?,
      'disabilityPercent', ?
     )
     WHERE setting_key = ?`,
    [
      config.childMaxAge,
      config.childPercent,
      config.seniorMinAge,
      config.seniorPercent,
      config.childEnabled,
      config.seniorEnabled,
      config.disabilityEnabled,
      config.disabilityPercent,
      'discount_rules',
    ],
  );
}
