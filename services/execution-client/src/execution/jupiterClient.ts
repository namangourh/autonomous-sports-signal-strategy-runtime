/**
 * Paper-mode price reference via Jupiter's public Quote API.
 *
 * Jupiter aggregates mainnet DEX liquidity — devnet has no meaningful
 * routing for it to quote against — so this deliberately calls mainnet for
 * a realistic, live SOL/USDC price. It only ever fetches a quote, never
 * /swap; nothing here submits a transaction or moves funds. On-chain proof
 * logging (log_signal) still targets devnet, where the program is deployed.
 */

const JUPITER_QUOTE_URL = process.env.JUPITER_BASE_URL
  ? `${process.env.JUPITER_BASE_URL}/swap/v1/quote`
  : "https://lite-api.jup.ag/swap/v1/quote";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;

export interface PaperQuote {
  inAmountUsdc: number;
  outAmountLamports: number;
  /** SOL price in USDC, implied by this quote (outAmount/inAmount, unit-adjusted). */
  solPriceUsdc: number;
}

/**
 * Quotes swapping `sizeUsdc` (whole USDC, not micro-units) into SOL, purely
 * as a paper-mode fill-price reference. Returns null if the quote API is
 * unreachable — callers should fall back to a neutral price rather than
 * fail the whole signal over a network hiccup.
 */
export async function getPaperFillQuote(sizeUsdc: number): Promise<PaperQuote | null> {
  const inAmount = Math.max(1, Math.round(sizeUsdc * 10 ** USDC_DECIMALS));
  const url = `${JUPITER_QUOTE_URL}?inputMint=${USDC_MINT}&outputMint=${SOL_MINT}&amount=${inAmount}&slippageBps=50`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return null;
    }
    const data = (await res.json()) as { inAmount: string; outAmount: string };
    const outAmountLamports = Number(data.outAmount);
    const solPriceUsdc = (inAmount / 10 ** USDC_DECIMALS) / (outAmountLamports / 1e9);
    return { inAmountUsdc: sizeUsdc, outAmountLamports, solPriceUsdc };
  } catch {
    return null;
  }
}
