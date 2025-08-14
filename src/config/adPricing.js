const PRICES_CENTS = {
  home_top: 5000, // $50.00
  home_bottom: 3000, // $30.00
  sidebar_right_1: 2000, // $20.00
  sidebar_right_2: 2000, // $20.00
  default: 3000, // $30.00
};

export function getPriceCentsForPlacement(p) {
  return Number.isFinite(PRICES_CENTS[p])
    ? PRICES_CENTS[p]
    : PRICES_CENTS.default;
}
