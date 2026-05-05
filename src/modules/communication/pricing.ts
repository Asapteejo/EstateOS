const DEFAULT_TOP_UP_PRICING = {
  amountNGN: 100,
  credits: 10,
};

export function getCreditsFromAmount(
  amountNGN: number,
  pricing: { amountNGN: number; credits: number } = DEFAULT_TOP_UP_PRICING,
) {
  if (!Number.isFinite(amountNGN) || amountNGN <= 0) {
    throw new Error("Top-up amount must be greater than zero.");
  }

  if (
    !Number.isFinite(pricing.amountNGN) ||
    pricing.amountNGN <= 0 ||
    !Number.isInteger(pricing.credits) ||
    pricing.credits <= 0
  ) {
    throw new Error("Communication credit pricing is invalid.");
  }

  return Math.floor((amountNGN / pricing.amountNGN) * pricing.credits);
}
