import { INTERNATIONAL_DOLLAR } from "./constants.js"
import { formatIncome, timeIntervalNoun } from "./currency.js"
import type { Currency, TimeInterval, View } from "./types.js"
import { formatCountryList } from "./welfareSentence.js"

/** More selected countries than this and the title stops naming them */
const MAX_COUNTRIES_IN_TITLE = 4

export function chartTitle(view: View, selectedCountries: string[]): string {
    if (view === "global")
        return "How is income distributed across the world's population?"
    if (selectedCountries.length === 0)
        return "How is income distributed in the selected countries?"
    // Naming three of seven countries would read as an arbitrary pick
    if (selectedCountries.length > MAX_COUNTRIES_IN_TITLE)
        return "How is income distributed across different countries?"
    return `How is income distributed in ${formatCountryList(selectedCountries)}?`
}

export function chartSubtitle(year: number, currency: Currency): string {
    return currency.code === INTERNATIONAL_DOLLAR.code
        ? `Data for ${year}, measured in international dollars, which adjusts for differences in the cost of living between countries.`
        : // The country stays: a currency shared by several countries (the euro) converts differently in each
          `Data for ${year}, measured in ${currency.name} (${currency.countryName}), adjusted for differences in the cost of living.`
}

/**
 * "living on less than $3 a day", the condition the legend's bars and the
 * tooltip's share are about; `short` as in formatIncome
 */
export function livingOnLessThanPhrase(
    line: number,
    currency: Currency,
    interval: TimeInterval,
    options: { short?: boolean } = {}
): string {
    return `living on less than ${formatIncome(line, currency, interval, options)} a ${timeIntervalNoun(interval)}`
}
