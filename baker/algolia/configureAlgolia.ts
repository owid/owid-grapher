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
import { countries } from "@ourworldindata/utils"
import { SearchIndexName } from "../../site/search/searchTypes.js"

export const CONTENT_GRAPH_ALGOLIA_INDEX = "graph"

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
        ranking: ["typo", "words", "proximity", "attribute", "exact", "custom"],
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

    const chartsIndex = client.initIndex(SearchIndexName.Charts)

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
        disableExactOnAttributes: ["tags"],
        optionalWords: ["vs"],
    })

    const pagesIndex = client.initIndex(SearchIndexName.Pages)

    await pagesIndex.setSettings({
        ...baseSettings,
        searchableAttributes: [
            "unordered(title)",
            "unordered(excerpt)",
            "unordered(tags)",
            "unordered(content)",
            "unordered(authors)",
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
        disableExactOnAttributes: ["tags"],
    })

    const explorersIndex = client.initIndex(SearchIndexName.Explorers)

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

    const synonyms = [
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
        ["rate", "share"],
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
    ]

    // Send all our country variant names to algolia as synonyms
    for (const country of countries) {
        if (country.variantNames)
            synonyms.push([country.name].concat(country.variantNames))
    }

    const algoliaSynonyms = synonyms.map((s) => {
        return {
            objectID: s.join("-"),
            type: "synonym",
            synonyms: s,
        } as Synonym
    })

    await pagesIndex.saveSynonyms(algoliaSynonyms, {
        replaceExistingSynonyms: true,
    })
    await chartsIndex.saveSynonyms(algoliaSynonyms, {
        replaceExistingSynonyms: true,
    })
    await explorersIndex.saveSynonyms(algoliaSynonyms, {
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

if (require.main === module) configureAlgolia()
