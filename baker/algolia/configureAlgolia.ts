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
import { countries } from "../../clientUtils/countries.js"

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
    }

    const chartsIndex = client.initIndex("charts")

    await chartsIndex.setSettings({
        ...baseSettings,
        searchableAttributes: [
            "unordered(title)",
            "unordered(slug)",
            "unordered(variantName)",
            "unordered(subtitle)",
            "unordered(_tags)",
            "unordered(availableEntities)",
        ],
        customRanking: [
            "desc(numRelatedArticles)",
            "asc(numDimensions)",
            "asc(titleLength)",
        ],
        attributesToSnippet: ["subtitle:24"],
        attributeForDistinct: "id",
        disableExactOnAttributes: ["_tags"],
        optionalWords: ["vs"],
    })

    const pagesIndex = client.initIndex("pages")

    await pagesIndex.setSettings({
        ...baseSettings,
        searchableAttributes: [
            "unordered(title)",
            "unordered(content)",
            "unordered(_tags)",
            "unordered(authors)",
        ],
        customRanking: ["desc(importance)"],
        attributesToSnippet: ["content:24"],
        attributeForDistinct: "slug",
        attributesForFaceting: ["searchable(_tags)", "searchable(authors)"],
        disableExactOnAttributes: ["_tags"],
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
        ["homosexual", "gay", "lesbian"],
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

configureAlgolia()
