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
        "gross domestic product",
        "economic output",
        "economic growth",
        "pib" /* spanish, french */,
        "pil" /* italian */,
        "bip" /* polish */,
        "bnp" /* swedish, danish, norwegian */,
    ],
    ["gdp per capita", "economic growth", "income per person"],
    ["per capita", "per person"],
    ["overpopulation", "population growth"],
    ["covid", "covid-19", "coronavirus", "corona"],
    ["flu", "influenza"],
    [
        "carbon footprint",
        "emissions footprint",
        "carbon emissions",
        "co2 emissions",
        "CO₂ emissions",
        "c02 emissions",
        "carbon dioxide emissions",
    ],
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
    [
        "clean water",
        "safe water",
        "drinking water",
        "water pollution",
        "water quality",
    ],
    ["water demand", "water withdrawal", "water scarcity", "water stress"],
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
        "llm",
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
        "air travel",
        "flight",
        "flights",
    ],
    [
        "EV",
        "EVs",
        "electric vehicle",
        "electric vehicles",
        "electric car",
        "electric cars",
        "hybrid car",
        "hybrid cars",
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
    ["smog", "air pollution", "air quality"],
    ["jail", "prison"],
    ["funding", "funded"],
    ["solar", "photovoltaic", "photovoltaics", "pv"],
    ["tb", "tuberculosis"],
    ["ntd", "neglected tropical diseases", "neglected tropical disease"],
    ["people", "population"],
    ["production", "generation"],
    ["farm", "farming", "agriculture", "food production"],
    ["life expectancy", "longevity"],
    ["fertility", "children per woman"],
    ["hiv", "aids", "hiv/aids"],
    ["obesity", "overweight", "body mass index", "bmi"],
    ["smoking", "tobacco", "cigarettes"],
    ["alcohol", "drinking"],
    ["stroke", "cerebrovascular"],
    ["heart", "cardiovascular", "cardiac"],
    ["inequality", "gini"],
    ["employment", "jobs", "workforce", "labor", "labour"],
    ["migration", "immigration", "emigration"],
    ["urbanization", "urbanisation", "urban"],
    ["foreign aid", "development assistance", "oda"],
    ["trade", "imports", "exports"],
    ["climate change", "global warming"],
    ["deforestation", "forest loss", "tree loss"],
    ["land use", "land-use", "land cover"],
    [
        "renewable energy",
        "clean energy",
        "green energy",
        "renewables",
        "alternative energy",
    ],
    ["biodiversity", "species", "ecosystem", "extinction", "habitat"],
    ["ocean", "marine", "sea"],
    ["soil", "land"],
    ["recycling", "reuse"],
    ["maternal mortality", "maternal death", "maternal deaths"],
    [
        "malnutrition",
        "undernutrition",
        "stunting",
        "wasting",
        "undernourished",
        "malnourished",
        "hunger",
        "undernourishment",
        "malnourishment",
        "food insecurity",
    ],
    ["micronutrient deficiency", "vitamin deficiency", "mineral deficiency"],
    ["contraception", "birth control", "family planning"],
    ["epidemic", "outbreak", "pandemic"],
    ["sanitation", "toilet", "toilets", "latrine", "latrines"],
    [
        "non-communicable disease",
        "ncd",
        "chronic disease",
        "non-communicable diseases",
        "chronic diseases",
    ],
    [
        "communicable disease",
        "infectious disease",
        "communicable diseases",
        "infectious diseases",
    ],
    ["maternal health", "reproductive health"],
    ["productivity", "labor productivity", "labour productivity"],
    ["debt", "public debt", "government debt"],
    ["consumption", "household spending", "expenditure", "income"],
    ["industrialization", "industrialisation", "manufacturing"],
    ["remittances", "money transfers", "money sent", "money received"],
    ["energy consumption", "energy use", "energy demand"],
    ["plastic pollution", "plastic waste"],
    ["soil erosion", "land degradation"],
    ["sea level rise", "sea levels", "ocean levels"],
    ["public transport", "public transportation", "mass transit"],
    ["internet", "broadband", "online"],
    [
        "mobile phone",
        "mobile phones",
        "cell phone",
        "cell phones",
        "smartphone",
        "smartphones",
    ],
    ["education", "schooling", "school"],
    ["literacy", "illiteracy", "literate", "illiterate", "read and write"],
    ["antibiotic resistance", "antimicrobial resistance"],
    ["healthcare", "health care", "medical care"],
    [
        "energy access",
        "electricity access",
        "access to electricity",
        "access to energy",
    ],
    ["solar power", "solar energy"],
    ["wind power", "wind energy"],
    ["hydropower", "hydro power", "hydroelectric power"],
    ["geothermal energy", "geothermal power"],
    ["nuclear power", "nuclear energy"],
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
