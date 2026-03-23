import { countries, excludeUndefined } from "@ourworldindata/utils"
import * as R from "remeda"
import { SynonymMap } from "@ourworldindata/types"

export const synonyms = [
    // Organizations
    ["owid", "our world in data"],
    ["imf", "international monetary fund"],

    // Units & measurements
    ["rate", "share", "percentage", "percent"],
    ["per capita", "per person"],
    ["price", "prices", "pricing", "cost", "costs"],
    ["meter", "metre", "meters", "metres"],
    ["kilometer", "kilometre", "kilometers", "kilometres"],
    ["time use", "time spent", "time spend"],

    // Population and Demographic Change
    ["people", "population"],
    ["pop", "population"],
    ["overpopulation", "population growth"],
    ["kids", "children"],
    ["fertility", "children per woman"],
    ["life expectancy", "longevity"],
    ["dying", "death", "deaths", "mortality"],
    ["child mortality", "infant mortality"],
    ["maternal mortality", "maternal death", "maternal deaths"],
    ["migration", "immigration", "emigration"],
    ["urbanization", "urbanisation", "urban"],

    // Health
    ["disease", "diseases", "illness"],
    ["healthcare", "health care", "medical care"],
    ["maternal health", "reproductive health"],
    ["epidemic", "outbreak", "pandemic"],
    ["incidence", "daily new confirmed cases"],
    [
        "hospital admission",
        "hospital admissions",
        "hospitalization",
        "hospitalizations",
        "hospitalisation",
        "hospitalisations",
        "in hospital",
    ],
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
    ["antibiotic resistance", "antimicrobial resistance"],
    ["covid", "covid-19", "coronavirus", "corona"],
    ["flu", "influenza"],
    ["hiv", "aids", "hiv/aids"],
    ["tb", "tuberculosis"],
    ["ntd", "neglected tropical diseases", "neglected tropical disease"],
    ["hpv", "human papillomavirus"],
    ["stroke", "cerebrovascular"],
    ["heart", "cardiovascular", "cardiac"],
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
    [
        "vaccine hesitancy",
        "vaccine attitude",
        "vaccine attitudes",
        "vaccine willingness",
    ],
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
    ["obesity", "overweight", "body mass index", "bmi"],
    ["smoking", "tobacco", "cigarettes"],
    ["alcohol", "drinking"],
    ["drug", "drugs", "substance use"],
    ["contraception", "birth control", "family planning"],
    ["fgm", "female genital mutilation"],
    ["depression", "depressive", "mental health"],
    [
        "happiness",
        "happy",
        "happyness" /* common typo */,
        "satisfaction",
        "life satisfaction",
    ],

    // Energy and Environment
    [
        "co2",
        "CO₂",
        "c02" /* common typo, zero instead of "o" */,
        "carbon dioxide",
    ],
    [
        "carbon footprint",
        "emissions footprint",
        "carbon emissions",
        "co2 emissions",
        "CO₂ emissions",
        "c02 emissions",
        "carbon dioxide emissions",
    ],
    ["ch4", "CH₄", "methane"],
    ["n2o", "N₂O", "nitrous oxide"],
    ["NOx", "NOₓ", "nitrogen dioxide"],
    ["ghg", "greenhouse gas"],
    ["climate change", "global warming"],
    ["smog", "air pollution", "air quality"],
    ["deforestation", "forest loss", "tree loss"],
    ["land use", "land-use", "land cover"],
    ["biodiversity", "species", "ecosystem", "extinction", "habitat"],
    ["ocean", "marine", "sea"],
    ["soil", "land"],
    ["soil erosion", "land degradation"],
    ["sea level rise", "sea levels", "ocean levels"],
    ["plastic pollution", "plastic waste"],
    ["recycling", "reuse"],
    ["electric power", "power", "electricity"],
    ["energy consumption", "energy use", "energy demand"],
    [
        "energy access",
        "electricity access",
        "access to electricity",
        "access to energy",
    ],
    [
        "renewable energy",
        "clean energy",
        "green energy",
        "renewables",
        "alternative energy",
    ],
    ["atomic", "nuclear"],
    ["nuclear power", "nuclear energy"],
    ["solar", "photovoltaic", "photovoltaics", "pv"],
    ["solar power", "solar energy"],
    ["wind power", "wind energy"],
    ["hydropower", "hydro power", "hydroelectric power"],
    ["geothermal energy", "geothermal power"],
    ["production", "generation"],

    // Food and Agriculture
    ["pork", "pigmeat"],
    ["cheese", "dairy"],
    ["farm", "farming", "agriculture", "food production"],
    [
        "clean water",
        "safe water",
        "drinking water",
        "water pollution",
        "water quality",
    ],
    ["water demand", "water withdrawal", "water scarcity", "water stress"],
    ["sanitation", "toilet", "toilets", "latrine", "latrines"],

    // Poverty and Economic Development
    [
        "gdp",
        "gross domestic product",
        "economic output",
        "pib" /* spanish, french */,
        "pil" /* italian */,
        "bip" /* polish */,
        "bnp" /* swedish, danish, norwegian */,
    ],
    ["gdp per capita", "income per person"],
    ["salary", "income"],
    ["poverty", "poor"],
    ["inequality", "gini"],
    ["inflation", "price change", "price changes", "change in price"],
    ["employment", "jobs", "workforce", "labor", "labour"],
    ["productivity", "labor productivity", "labour productivity"],
    ["debt", "public debt", "government debt"],
    ["industrialization", "industrialisation", "manufacturing"],
    ["remittances", "money transfers", "money sent", "money received"],
    ["foreign aid", "development assistance", "oda"],
    ["fdi", "foreign direct investment"],
    ["funding", "funded"],
    ["r&d", "r & d", "research"],
    ["hdi", "human development index", "idh" /* spanish, french */],
    [
        "sdg",
        "sdgs",
        "sustainable development goal",
        "sustainable development goals",
        "sdg tracker",
    ],

    // Education and Knowledge
    ["education", "schooling", "school"],
    ["tertiary", "university", "college", "post-secondary"],
    ["literacy", "illiteracy", "literate", "illiterate", "read and write"],
    ["enrollment", "enrolment", "enrolled"],

    // Innovation and Technological Change
    [
        "artificial intelligence",
        "ai",
        "machine learning",
        "neural network",
        "chatgpt",
        "chat gpt",
        "llm",
    ],
    ["internet", "broadband", "online"],
    [
        "mobile phone",
        "mobile phones",
        "cell phone",
        "cell phones",
        "smartphone",
        "smartphones",
    ],
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
    ["public transport", "public transportation", "mass transit"],
    [
        "self-driving",
        "driverless",
        "autonomous car",
        "autonomous vehicle",
        "self driving",
        "robotaxis",
    ],

    // Human Rights and Democracy
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
        "sexism",
        "gender discrimination",
        "gender gap",
        "gender inequality",
        "gender inequalities",
        "inequality by gender",
    ],
    ["sex", "gender"],
    ["jail", "prison"],

    // Violence and War
    ["homicide", "murder", "murders"],
    ["gun", "guns", "firearm", "firearms"],
    ["conflict", "war"],
    ["defense", "defence", "military"],

    // Geography
    ["gaza", "palestine", "west bank"],
    ["turkey", "türkiye", "turkiye"],
    ["ivory coast", "côte d'ivoire", "cote d'ivoire"],
    ["burma", "myanmar"],
    ["holland", "netherlands"],
    ["timor-leste", "timor leste", "east timor"],
    ["cabo verde", "cape verde"],
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
            const [, otherTerms] = R.partition(group, (t) => t === term)
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
