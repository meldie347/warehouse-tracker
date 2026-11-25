export const ADJUST_DEDUCTION_REASONS = [
  "Damaged",
  "Miscount / correction",
  "Theft or loss",
  "Other",
] as const;

// No "Restock" option here — that's "Receive stock" now, a separate action.
export const ADJUST_INCREASE_REASONS = ["Miscount / correction", "Other"] as const;

export type AdjustDeductionReason = (typeof ADJUST_DEDUCTION_REASONS)[number];
export type AdjustIncreaseReason = (typeof ADJUST_INCREASE_REASONS)[number];
