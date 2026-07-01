/**
 * Fractional-Kelly position sizing. `candidateImpliedProb` is the implied
 * probability of the price we'd actually trade at; `edge` is
 * fairProbability - candidateImpliedProb, as produced by the signal engine's
 * ValueBetDetector/MomentumSignal (see services/signal-engine).
 *
 * kellyFraction defaults to 0.5 (half-Kelly) to damp variance from imperfect
 * edge estimates — full Kelly is too aggressive for a strategy whose edge is
 * a model estimate rather than a known probability.
 */
export function calculatePositionSizeUsdc(
  candidateImpliedProb: number,
  edge: number,
  bankrollUsdc: number,
  maxPositionUsdc: number,
  kellyFraction = 0.5,
): number {
  if (candidateImpliedProb <= 0 || candidateImpliedProb >= 1) {
    return 0;
  }

  const decimalOdds = 1 / candidateImpliedProb;
  const netOdds = decimalOdds - 1;
  const fairProb = candidateImpliedProb + edge;
  const lossProb = 1 - fairProb;

  if (netOdds <= 0) {
    return 0;
  }

  const fullKelly = (netOdds * fairProb - lossProb) / netOdds;
  const sizedFraction = Math.max(0, fullKelly * kellyFraction);

  return Math.min(sizedFraction * bankrollUsdc, maxPositionUsdc);
}
