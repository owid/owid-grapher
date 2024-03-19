import algoliasearch, { SearchClient } from "algoliasearch"
import { Synonym, Settings } from "@algolia/client-search"
import {
    ALGOLIA_ID,
    TOPICS_CONTENT_GRAPH,
} from "../../settings/clientSettings.js"

import {
    ALGOLIA_INDEXING,
    ALGOLIA_SECRET_KEY,
} from "../../settings/serverSettings.js"
import { countries, excludeUndefined } from "@ourworldindata/utils"
import { SearchIndexName } from "../../site/search/searchTypes.js"
import { getIndexName } from "../../site/search/searchClient.js"

export const CONTENT_GRAPH_ALGOLIA_INDEX = getIndexName("graph")

export const getAlgoliaClient = (): SearchClient | undefined => {
    if (!ALGOLIA_ID || !ALGOLIA_SECRET_KEY) {
        console.error(`Missing ALGOLIA_ID or ALGOLIA_SECRET_KEY`)
        return
    }

    const client = algoliasearch(ALGOLIA_ID, ALGOLIA_SECRET_KEY)
    return client
}

// This function initializes and applies settings to the Algolia search indices
// Algolia settings should be configured here rather than in the Algolia dashboard UI, as then
// they are recorded and transferrable across dev/prod instances
export const configureAlgolia = async () => {
    if (!ALGOLIA_INDEXING) return

    const client = getAlgoliaClient()
    if (!client)
        // throwing here to halt deploy process
        throw new Error("Algolia configuration failed (client not initialized)")

    const baseSettings: Settings = {
        queryLanguages: ["en"],
        indexLanguages: ["en"],

        // see https://www.algolia.com/doc/guides/managing-results/relevance-overview/in-depth/ranking-criteria/
        ranking: ["typo", "words", "exact", "proximity", "attribute", "custom"],
        alternativesAsExact: [
            "ignorePlurals",
            "singleWordSynonym",
            "multiWordsSynonym",
        ],
        ignorePlurals: true,
        exactOnSingleWordQuery: "none",
        removeStopWords: ["en"],
        snippetEllipsisText: "…",
        highlightPreTag: "<strong>",
        highlightPostTag: "</strong>",
        distinct: true,
        advancedSyntax: true,
        advancedSyntaxFeatures: ["exactPhrase"],
        unretrievableAttributes: ["views_7d", "score"],
    }

    const chartsIndex = client.initIndex(getIndexName(SearchIndexName.Charts))

    await chartsIndex.setSettings({
        ...baseSettings,
        searchableAttributes: [
            /**
             * It may seem unintuitive that we're ranking `keyChartForTags` higher than `title`.
             * However, many of the search queries we get are for "topics", like `migration` or
             * `tourism`. If for this topic we have a key chart, we want to show that first,
             * since that's hand-picked to be super relevant for the topic.
             */
            "unordered(keyChartForTags)",
            "unordered(title)",
            "unordered(slug)",
            "unordered(variantName)",
            "unordered(subtitle)",
            "unordered(tags)",
            "unordered(availableEntities)",
        ],
        customRanking: [
            "desc(score)",
            "desc(numRelatedArticles)",
            "asc(numDimensions)",
            "asc(titleLength)",
        ],
        attributesToSnippet: ["subtitle:24"],
        attributeForDistinct: "id",
        optionalWords: ["vs"],

        // These lines below essentially demote matches in the `subtitle` and `availableEntities` fields:
        // If we find a match (only) there, then it doesn't count towards `exact`, and is therefore ranked lower.
        // We also disable prefix matching and typo tolerance on these.
        disableExactOnAttributes: ["tags", "subtitle", "availableEntities"],
        disableTypoToleranceOnAttributes: ["subtitle", "availableEntities"],
        disablePrefixOnAttributes: ["subtitle"],
    })

    const pagesIndex = client.initIndex(getIndexName(SearchIndexName.Pages))

    await pagesIndex.setSettings({
        ...baseSettings,
        searchableAttributes: [
            "unordered(title)",
            "unordered(excerpt)",
            "unordered(tags)",
            "unordered(authors)",
            "unordered(content)",
        ],
        customRanking: ["desc(score)", "desc(importance)"],
        attributesToSnippet: ["excerpt:20", "content:20"],
        attributeForDistinct: "slug",
        attributesForFaceting: [
            "afterDistinct(type)",
            "afterDistinct(searchable(tags))",
            "afterDistinct(searchable(authors))",
            "afterDistinct(documentType)",
        ],

        // These lines below essentially demote matches in the `content` (i.e. fulltext) field:
        // If we find a match (only) there, then it doesn't count towards `exact`, and is therefore ranked lower.
        // We also disable prefix matching and typo tolerance on `content`, so that "corn" doesn't match "corner", for example.
        disableExactOnAttributes: ["tags", "content"],
        disableTypoToleranceOnAttributes: ["content"],
        disablePrefixOnAttributes: ["content"],
    })

    const explorersIndex = client.initIndex(
        getIndexName(SearchIndexName.Explorers)
    )

    await explorersIndex.setSettings({
        ...baseSettings,
        searchableAttributes: [
            "unordered(slug)",
            "unordered(title)",
            "unordered(subtitle)",
            "unordered(text)",
        ],
        customRanking: ["desc(views_7d)"],
        attributeForDistinct: "slug",
        attributesForFaceting: [],
        disableTypoToleranceOnAttributes: ["text"],
    })

    const explorerViewsIndex = client.initIndex(
        getIndexName(SearchIndexName.ExplorerViews)
    )

    await explorerViewsIndex.setSettings({
        ...baseSettings,
        searchableAttributes: [
            "unordered(explorerTitle)",
            "unordered(viewTitle)",
            "unordered(viewSettings)",
        ],
        customRanking: [
            // For multiple explorer views with the same title, we want to avoid surfacing duplicates.
            // So, rank a result with viewTitleIndexWithinExplorer=0 way more highly than one with 1, 2, etc.
            "asc(viewTitleIndexWithinExplorer)",
            "desc(score)",
            "asc(viewIndexWithinExplorer)",
        ],
        attributeForDistinct: "explorerSlug",
        distinct: 4,
        minWordSizefor1Typo: 6,
    })

    const synonyms = [
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
    ]

    const algoliaSynonyms = synonyms.map((s) => {
        return {
            objectID: s.join("-"),
            type: "synonym",
            synonyms: s,
        } as Synonym
    })

    // Send all our country variant names to algolia as one-way synonyms
    for (const country of countries) {
        const alternatives = excludeUndefined([
            country.shortName,
            ...(country.variantNames ?? []),
        ])
        for (const alternative of alternatives)
            algoliaSynonyms.push({
                objectID: `${alternative}->${country.name}`,
                type: "oneWaySynonym",
                input: alternative,
                synonyms: [country.name],
            })
    }

    await pagesIndex.saveSynonyms(algoliaSynonyms, {
        replaceExistingSynonyms: true,
    })
    await chartsIndex.saveSynonyms(algoliaSynonyms, {
        replaceExistingSynonyms: true,
    })
    await explorersIndex.saveSynonyms(algoliaSynonyms, {
        replaceExistingSynonyms: true,
    })
    await explorerViewsIndex.saveSynonyms(algoliaSynonyms, {
        replaceExistingSynonyms: true,
    })

    if (TOPICS_CONTENT_GRAPH) {
        const graphIndex = client.initIndex(CONTENT_GRAPH_ALGOLIA_INDEX)

        await graphIndex.setSettings({
            attributesForFaceting: [
                ...[...Array(5)].map((_, i) => `searchable(topics.lvl${i})`),
                "searchable(type)",
            ],
        })
    }
}

if (require.main === module) void configureAlgolia()
