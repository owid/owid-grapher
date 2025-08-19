import { countries, excludeUndefined } from "@ourworldindata/utils"
import { partition } from "remeda"
import { SynonymMap } from "./searchTypes.js"

export const synonyms = [
    ["owid", "our world in data"],
    ["kids", "children"],
    ["pork", "pigmeat"],
    ["atomic", "nuclear"],
    ["pop", "population"],
    ["cheese", "dairy"],
    [
        "gdp",
        "economic growth",
        "pib" /* spanish, french */,
        "pil" /* italian */,
        "bip" /* polish */,
        "bnp" /* swedish, danish, norwegian */,
    ],
    ["gdp per capita", "economic growth"],
    ["per capita", "per person"],
    ["overpopulation", "population growth"],
    ["covid", "covid-19", "coronavirus", "corona"],
    ["flu", "influenza"],
    [
        "co2",
        "CO₂",
        "c02" /* we consistently get some of these, with a zero for the "o" */,
        "carbon dioxide",
    ],
    ["ch4", "CH₄", "methane"],
    ["n2o", "N₂O", "nitrous oxide"],
    ["NOx", "NOₓ", "nitrogen dioxide"],
    ["price", "prices", "pricing", "cost", "costs"],
    [
        "immunization",
        "immunizations",
        "immunisation",
        "immunisations",
        "vaccine",
        "vaccines",
        "vaccination",
        "vaccinations",
        "vacuna" /* spanish */,
    ],
    ["ghg", "greenhouse gas"],
    ["rate", "share", "percentage", "percent"],
    [
        "hospital admission",
        "hospital admissions",
        "hospitalization",
        "hospitalizations",
        "hospitalisation",
        "hospitalisations",
        "in hospital",
    ],
    ["incidence", "daily new confirmed cases"],
    [
        "homosexual",
        "homosexuality",
        "gay",
        "lesbian",
        "LGBT",
        "LGBTQ",
        "LGBTQIA",
    ],
    ["clean water", "safe water", "drinking water"],
    ["water demand", "water withdrawal"],
    [
        "vaccine hesitancy",
        "vaccine attitude",
        "vaccine attitudes",
        "vaccine willingness",
    ],
    ["electric power", "power", "electricity"],
    [
        "artificial intelligence",
        "ai",
        "machine learning",
        "neural network",
        "chatgpt", // added in 2023-03, we might want to remove this in the future
        "chat gpt",
    ],
    ["hdi", "human development index", "idh" /* spanish, french */],
    ["drug", "drugs", "substance use"],
    ["r&d", "r & d", "research"],
    [
        "plane",
        "planes",
        "airplane",
        "airplanes",
        "aviation",
        "airline",
        "airlines",
        "flying",
    ],
    [
        "EV",
        "EVs",
        "electric vehicle",
        "electric vehicles",
        "electric car",
        "electric cars",
    ],
    ["trains", "railway"],
    ["dying", "death", "deaths", "mortality"],
    ["disease", "diseases", "illness"],
    ["poverty", "poor"],
    ["homicide", "murder", "murders"],
    ["inflation", "price change", "price changes", "change in price"],
    ["gun", "guns", "firearm", "firearms"],
    [
        "happiness",
        "happy",
        "happyness" /* common typo */,
        "satisfaction",
        "life satisfaction",
    ],
    [
        "sdg",
        "sdgs",
        "sustainable development goal",
        "sustainable development goals",
        "sdg tracker",
    ],
    [
        "sexism",
        "gender discrimination",
        "gender gap",
        "gender inequality",
        "gender inequalities",
        "inequality by gender",
    ],
    ["child mortality", "infant mortality"],
    ["depression", "depressive", "mental health"],
    ["time use", "time spent", "time spend"],
    ["enrollment", "enrolment", "enrolled"],
    ["meter", "metre", "meters", "metres"],
    ["kilometer", "kilometre", "kilometers", "kilometres"],
    ["defense", "defence", "military"],
    ["smog", "air pollution"],
    ["jail", "prison"],
    ["funding", "funded"],
    ["solar", "photovoltaic", "photovoltaics", "pv"],
    ["tb", "tuberculosis"],
    ["ntd", "neglected tropical diseases", "neglected tropical disease"],
    ["people", "population"],
    ["production", "generation"],
]

/**
 * Builds a synonym map where each term points to all its possible synonyms across groups.
 * Handles both bidirectional synonyms (from synonym groups) and unidirectional country alternatives.
 *
 * Examples:
 * - Bidirectional: "ai" → ["artificial intelligence", "machine learning", "neural network"]
 * - Bidirectional: "artificial intelligence" → ["ai", "machine learning", "neural network"]
 * - Unidirectional: "us" → ["united states"] (but "united states" does not map back to "us")
 * - Unidirectional: "uk" → ["united kingdom"]
 *
 * @returns Map where keys are lowercase terms and values are arrays of their synonyms
 */
export function buildSynonymMap(): SynonymMap {
    const synonymMap: SynonymMap = new Map()

    // Process bidirectional synonym groups
    for (const group of synonyms) {
        for (const term of group) {
            const [, otherTerms] = partition(group, (t) => t === term)
            const termLower = term.toLowerCase()
            const otherTermsLower = otherTerms.map((t) => t.toLowerCase())

            if (synonymMap.has(termLower)) {
                // Merge with existing synonyms, avoiding overriding previous
                // synonyms (e.g. "economic growth")
                const existing = synonymMap.get(termLower)!
                const combined = [...existing, ...otherTermsLower]
                synonymMap.set(termLower, [...new Set(combined)])
            } else {
                synonymMap.set(termLower, otherTermsLower)
            }
        }
    }

    // Process unidirectional country alternatives (us -> united states, but not united states -> us)
    for (const country of countries) {
        const alternatives = excludeUndefined([
            country.shortName,
            ...(country.variantNames ?? []),
        ])

        for (const alternative of alternatives) {
            const alternativeLower = alternative.toLowerCase()
            const countryNameLower = country.name.toLowerCase()
            // this will technically overwrite any existing synonym mapping with
            // country alternatives. In practice the risk of collision is low
            // given that we don't use countries' short codes (only short names
            // and variants, which amounts to less 10 countries). So code
            // simplicity is favoured here.
            synonymMap.set(alternativeLower, [countryNameLower])
        }
    }

    return synonymMap
}
