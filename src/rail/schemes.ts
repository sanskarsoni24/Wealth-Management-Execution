/**
 * Scheme catalog. In production this comes from the NSE Master Download (scheme
 * codes, min amounts, cutoffs). Here it's a small curated set, consumer-shaped:
 * the UI shows the plain name + research rationale, never the schemeCode.
 */
export interface Scheme {
  schemeCode: string; // RAIL-ONLY (e.g. AXBDGP-GR). Never rendered, never in a URL.
  slug: string; // consumer-facing fund id used in routes (the app never sees schemeCode)
  name: string;
  category: string;
  riskWords: string; // risk level in plain words
  minAmount: number;
  multiple: number;
  sipMin: number;
  nav: number;
  rationale: string; // "why our research team likes this"
  oneYear: number; // illustrative past performance %
  threeYear: number;
  isElss?: boolean; // 3-year lock-in
  recommendedForFirstTimer?: boolean;
  closedToNew?: boolean; // demo: scheme suspended for new purchases
}

export const SCHEMES: Scheme[] = [
  {
    schemeCode: "PRBLCHP-GR",
    slug: "prudent-bluechip",
    name: "Prudent Bluechip Fund",
    category: "Large Cap Equity",
    riskWords: "Moderately high risk",
    minAmount: 500,
    multiple: 100,
    sipMin: 500,
    nav: 120.98,
    rationale:
      "A steady, diversified mix of India's largest, most established companies — a sensible first step that doesn't chase last year's winner.",
    oneYear: 14.2,
    threeYear: 12.6,
    recommendedForFirstTimer: true,
  },
  {
    schemeCode: "STDYBAL-GR",
    slug: "steady-balanced",
    name: "Steady Balanced Advantage Fund",
    category: "Hybrid",
    riskWords: "Moderate risk",
    minAmount: 500,
    multiple: 100,
    sipMin: 500,
    nav: 48.31,
    rationale:
      "Balances equity and debt automatically, so it rides out the bumps better than a pure equity fund — calmer for a first-timer.",
    oneYear: 11.1,
    threeYear: 10.2,
  },
  {
    schemeCode: "TAXSVR3Y-GR",
    slug: "taxsaver-elss",
    name: "TaxSaver ELSS Fund",
    category: "Equity (Tax-saving)",
    riskWords: "High risk",
    minAmount: 500,
    multiple: 500,
    sipMin: 500,
    nav: 86.44,
    rationale:
      "Saves tax under 80C and invests for the long term. Note the 3-year lock-in — your money stays invested for at least three years.",
    oneYear: 16.8,
    threeYear: 14.0,
    isElss: true,
  },
  {
    schemeCode: "LIQDOVR-GR",
    slug: "overnight-liquid",
    name: "Overnight Liquid Fund",
    category: "Liquid / Overnight",
    riskWords: "Low risk",
    minAmount: 500,
    multiple: 100,
    sipMin: 500,
    nav: 1234.56,
    rationale:
      "A parking spot for money you might need soon — very low risk, settles faster than equity funds.",
    oneYear: 6.9,
    threeYear: 6.4,
  },
  {
    schemeCode: "EMRGMID-GR",
    slug: "emerging-midcap",
    name: "Emerging Midcap Fund",
    category: "Mid Cap Equity",
    riskWords: "Very high risk",
    minAmount: 1000,
    multiple: 100,
    sipMin: 1000,
    nav: 64.22,
    rationale:
      "Higher growth potential from smaller companies, with bigger swings. Best as a small slice once you've started.",
    oneYear: 22.4,
    threeYear: 17.9,
    closedToNew: true, // demo: "this fund isn't accepting new investments"
  },
];

export function getScheme(code: string): Scheme | undefined {
  return SCHEMES.find((s) => s.schemeCode === code);
}

export function getSchemeBySlug(slug: string): Scheme | undefined {
  return SCHEMES.find((s) => s.slug === slug);
}

export const RECOMMENDED_FIRST = SCHEMES.find(
  (s) => s.recommendedForFirstTimer,
)!;
