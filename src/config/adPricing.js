const PRICES_CENTS = {
  home_top: 100, // $50.00
  home_bottom: 100, // $30.00
  sidebar_right_1: 100, // $20.00
  sidebar_right_2: 100, // $20.00
  default: 100, // $30.00
};

export function getPriceCentsForPlacement(p) {
  return Number.isFinite(PRICES_CENTS[p])
    ? PRICES_CENTS[p]
    : PRICES_CENTS.default;
}
