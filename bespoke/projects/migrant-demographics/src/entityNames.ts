import { articulateEntity, getRegionByName } from "@ourworldindata/utils"

/**
 * Translate a UN DESA entity name into the name we display. Countries map to
 * their OWID region names so that geolocation (which reports OWID names) and
 * the familiar OWID naming both work; UN aggregates keep their UN names.
 */
export function toDisplayName(unName: string): string {
    const mapped = UN_TO_OWID_NAME[unName]
    if (mapped) return mapped
    if (getRegionByName(unName)) return unName
    if (unName === unName.toUpperCase()) return titleCaseAggregate(unName)
    return unName
}

/** "living in {X}" — adds articles and lowercases group aggregates */
export function entityNameForSentence(displayName: string): string {
    if (displayName === "World") return "the world"
    if (ENTITIES_WITH_ARTICLE.has(displayName)) return `the ${displayName}`
    if (GROUP_AGGREGATE_REGEX.test(displayName))
        return displayName.charAt(0).toLowerCase() + displayName.slice(1)
    return articulateEntity(displayName)
}

/** UN names that differ from the OWID region names */
const UN_TO_OWID_NAME: Record<string, string> = {
    "United States of America": "United States",
    "United Republic of Tanzania": "Tanzania",
    "Democratic Republic of the Congo": "Democratic Republic of Congo",
    "Cabo Verde": "Cape Verde",
    "Côte d'Ivoire": "Cote d'Ivoire",
    "China, Hong Kong SAR": "Hong Kong",
    "China, Macao SAR": "Macao",
    "China, Taiwan Province of China": "Taiwan",
    "Dem. People's Republic of Korea": "North Korea",
    "Republic of Korea": "South Korea",
    "Brunei Darussalam": "Brunei",
    "Lao People's Democratic Republic": "Laos",
    "Timor-Leste": "East Timor",
    "Viet Nam": "Vietnam",
    "Iran (Islamic Republic of)": "Iran",
    "State of Palestine": "Palestine",
    "Syrian Arab Republic": "Syria",
    "Republic of Moldova": "Moldova",
    "Russian Federation": "Russia",
    "Holy See": "Vatican",
    "Bonaire, Sint Eustatius and Saba": "Bonaire Sint Eustatius and Saba",
    Curaçao: "Curacao",
    "Saint Barthélemy": "Saint Barthelemy",
    "Bolivia (Plurinational State of)": "Bolivia",
    "Falkland Islands (Malvinas)": "Falkland Islands",
    "Venezuela (Bolivarian Republic of)": "Venezuela",
    "Micronesia (Fed. States of)": "Micronesia (country)",
    "Wallis and Futuna Islands": "Wallis and Futuna",
    Réunion: "Reunion",
}

/**
 * UN aggregates whose names read as groups rather than proper place names —
 * these get a lowercase first letter mid-sentence ("living in high-income
 * countries").
 */
const GROUP_AGGREGATE_REGEX = /(countries|regions|developing states)/i

/** Aggregates that need "the" but aren't in the OWID article list */
const ENTITIES_WITH_ARTICLE = new Set(["Caribbean"])

/**
 * Title-case an all-caps UN aggregate name ("LATIN AMERICA AND THE
 * CARIBBEAN" → "Latin America and the Caribbean")
 */
function titleCaseAggregate(name: string): string {
    const minorWords = new Set(["and", "the", "of", "excluding"])
    return name
        .toLowerCase()
        .split(" ")
        .map((word, i) =>
            i > 0 && minorWords.has(word)
                ? word
                : word.charAt(0).toUpperCase() + word.slice(1)
        )
        .join(" ")
}
