export type DiscountType = 'none' | 'child' | 'senior' | 'disability';
export type FareType = 'adult' | 'child' | 'senior' | 'disability';

export const DISCOUNT_RULES = {
  childMaxAge: 11,
  seniorMinAge: 60,
  childPercent: 50,
  seniorPercent: 30,
  childEnabled: true,
  seniorEnabled: true,
  disabilityEnabled: true,
  disabilityPercent: 40,
} as const;

type DiscountRules = {
  childMaxAge: number;
  childPercent: number;
  seniorMinAge: number;
  seniorPercent: number;
  childEnabled?: boolean;
  seniorEnabled?: boolean;
  disabilityEnabled?: boolean;
  disabilityPercent?: number;
};

export function getDiscountByAge(age: number, rules?: DiscountRules): { type: DiscountType; percent: number } {
  const activeRules = rules ?? DISCOUNT_RULES;

  if (age <= activeRules.childMaxAge) {
    return { type: 'child', percent: activeRules.childPercent };
  }

  if (age >= activeRules.seniorMinAge) {
    return { type: 'senior', percent: activeRules.seniorPercent };
  }

  return { type: 'none', percent: 0 };
}

export function getDiscountByFareType(fareType: FareType, rules?: DiscountRules): { type: DiscountType; percent: number } {
  const activeRules = rules ?? DISCOUNT_RULES;

  if (fareType === 'child' && activeRules.childEnabled !== false) {
    return { type: 'child', percent: activeRules.childPercent };
  }

  if (fareType === 'senior' && activeRules.seniorEnabled !== false) {
    return { type: 'senior', percent: activeRules.seniorPercent };
  }

  if (fareType === 'disability' && activeRules.disabilityEnabled !== false) {
    return { type: 'disability', percent: activeRules.disabilityPercent ?? 0 };
  }

  return { type: 'none', percent: 0 };
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
