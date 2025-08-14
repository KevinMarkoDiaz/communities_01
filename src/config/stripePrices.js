export const PRICE_IDS = {
  home_top: process.env.PRICE_HOME_TOP,
  home_bottom: process.env.PRICE_HOME_BOTTOM,
  sidebar_right_1: process.env.PRICE_SIDEBAR_RIGHT_1,
  sidebar_right_2: process.env.PRICE_SIDEBAR_RIGHT_2,
  default: process.env.PRICE_DEFAULT,
};

export function getPriceIdForPlacement(p) {
  return PRICE_IDS[p] || PRICE_IDS.default || null;
}
