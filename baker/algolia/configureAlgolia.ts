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
        ranking: ["exact", "typo", "attribute", "words", "proximity", "custom"],
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

    const chartsIndex = client.initIndex("charts")

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

    const pagesIndex = client.initIndex("pages")

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
            "type",
            "searchable(tags)",
            "searchable(authors)",
        ],
        disableExactOnAttributes: ["tags"],
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
        ],
        ["overpopulation", "population growth"],
        ["covid", "covid-19", "coronavirus", "corona"],
        ["flu", "influenza"],
        ["co2", "CO₂", "carbon dioxide"],
        ["ch4", "CH₄", "methane"],
        ["n2o", "N₂O", "nitrous oxide"],
        ["NOx", "NOₓ", "nitrogen dioxide"],
        ["price", "cost"],
        ["vaccine", "vaccination", "vacuna" /* spanish */],
        ["ghg", "greenhouse gas"],
        ["rate", "share"],
        [
            "hospital admission",
            "hospitalization",
            "hospitalisation",
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
        ["vaccine hesitancy", "vaccine attitude", "vaccine willingness"],
        ["electric power", "power", "electricity"],
        [
            "artificial intelligence",
            "ai",
            "machine learning",
            "neural network",
            "chatgpt", // added in 2023-03, we might want to remove this in the future
        ],
        ["hdi", "human development index"],
        ["drug", "drugs", "substance use"],
        ["r&d", "r & d", "research"],
        ["plane", "airplane", "aviation", "airline", "flying"],
        ["ev", "electric vehicle", "electric car"],
        ["train", "railway"],
        ["dying", "death", "mortality"],
        ["disease", "illness"],
        ["poverty", "poor"],
        ["homicide", "murder"],
        ["inflation", "price change", "price changes", "change in price"],
        ["gun", "guns", "firearm", "firearms"],
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
