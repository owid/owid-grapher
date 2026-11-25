import { FIRST_NOWCAST_YEAR, INTERNATIONAL_DOLLAR } from "./constants.js"
import { formatIncome } from "./currency.js"
import { formatCountryList, timeIntervalNoun } from "./format.js"
import type { Currency, TimeInterval, View } from "./types.js"
import type { WelfareSentenceSegment } from "./welfareSentence.js"

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

/**
 * The chart's footer note: what the data measures (the countries view's own
 * sentence on which countries report what, else the general one), the
 * international line's definition when it's drawn, the nowcast caveat and
 * the currency conversion. Segments, as the welfare terms render as
 * details-on-demand spans.
 */
export function chartNoteSegments(
    currency: Currency,
    year: number,
    isInternationalLine: boolean,
    /** Countries view: which of the countries shown report which (welfareTypeSentence) */
    welfareSentence?: WelfareSentenceSegment[]
): WelfareSentenceSegment[] {
    // The countries' own sentence says what each reports, so it replaces
    // the general one
    const sentences = welfareSentence
        ? []
        : [
              "Depending on the country, the data relates to income measured after taxes and benefits, or to consumption, per capita.",
          ]
    // Below the plot rather than in the subtitle, so picking or dragging the
    // line never reflows the chart above it
    if (isInternationalLine)
        sentences.push(
            "The International Poverty Line is set by the World Bank as its definition of extreme poverty."
        )
    if (year >= FIRST_NOWCAST_YEAR)
        sentences.push(
            `Figures for ${year} are World Bank nowcasts, which extrapolate the latest household surveys using economic growth.`
        )
    if (currency.code !== INTERNATIONAL_DOLLAR.code)
        sentences.push(
            `Incomes in local currencies are converted from international-$ using PPP conversion factors and adjusted for inflation to ${currency.pricesYear ? `${currency.pricesYear} prices` : "the latest year available"}.`
        )
    if (!welfareSentence) return [sentences.join(" ")]
    return [
        ...welfareSentence,
        sentences.map((sentence) => ` ${sentence}`).join(""),
    ]
}
