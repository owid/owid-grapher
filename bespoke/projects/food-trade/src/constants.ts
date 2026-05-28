export type VariantName = "sankey"

/** Sentinel for the country dropdown: shows global bilateral trade for the
 *  selected product (no central country anchor). */
export const ALL_COUNTRIES = "All countries"
export const isAllCountry = (c: string): boolean => c === ALL_COUNTRIES
