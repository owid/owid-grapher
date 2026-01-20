import { algoliasearch, SearchClient } from "algoliasearch"
import type { SynonymHit, IndexSettings } from "@algolia/client-search"
import {
    ALGOLIA_ID,
    TOPICS_CONTENT_GRAPH,
} from "../../settings/clientSettings.js"

import {
    ALGOLIA_INDEXING,
    ALGOLIA_SECRET_KEY,
} from "../../settings/serverSettings.js"
import { countries, excludeUndefined } from "@ourworldindata/utils"
import { SearchIndexName } from "@ourworldindata/types"
import { getIndexName } from "../../site/search/searchClient.js"
import { synonyms } from "../../site/search/synonymUtils.js"

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

    const baseSettings: IndexSettings = {
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
        distinct: true,
        advancedSyntax: true,
        advancedSyntaxFeatures: ["exactPhrase"],
        unretrievableAttributes: ["views_7d", "score"],
    }

    const chartsIndexName = getIndexName(SearchIndexName.Charts)

    await client.setSettings({
        indexName: chartsIndexName,
        indexSettings: {
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
            ranking: [
                "typo",
                "words",
                "exact",
                "attribute",
                "custom",
                "proximity",
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
        },
    })

    const pagesIndexName = getIndexName(SearchIndexName.Pages)

    await client.setSettings({
        indexName: pagesIndexName,
        indexSettings: {
            ...baseSettings,
            searchableAttributes: [
                "unordered(title)",
                "unordered(excerpt)",
                "unordered(tags)",
                "unordered(authors)",
                "unordered(content)",
            ],
            customRanking: ["desc(score)", "desc(importance)"],
            attributesToSnippet: ["content:20"],
            attributeForDistinct: "slug",
            attributesForFaceting: [
                "filterOnly(slug)",
                "afterDistinct(type)",
                "afterDistinct(searchable(tags))",
                "afterDistinct(searchable(authors))",
            ],

            // These lines below essentially demote matches in the `content` (i.e. fulltext) field:
            // If we find a match (only) there, then it doesn't count towards `exact`, and is therefore ranked lower.
            // We also disable prefix matching and typo tolerance on `content`, so that "corn" doesn't match "corner", for example.
            disableExactOnAttributes: ["tags", "content"],
            disableTypoToleranceOnAttributes: ["content"],
            disablePrefixOnAttributes: ["content"],
        },
    })

    const explorerViewsAndChartsIndexName = getIndexName(
        SearchIndexName.ExplorerViewsMdimViewsAndCharts
    )

    await client.setSettings({
        indexName: explorerViewsAndChartsIndexName,
        indexSettings: {
            ...baseSettings,
            searchableAttributes: [
                "unordered(title)",
                "unordered(slug)",
                "unordered(variantName)",
                "unordered(subtitle)",
                "unordered(tags)",
                "unordered(availableEntities)",
                "unordered(originalAvailableEntities)",
            ],
            ranking: [
                "typo",
                "words",
                "exact",
                "attribute",
                "custom",
                "proximity",
            ],
            customRanking: [
                "desc(score)",
                // For multiple explorer views with the same title, we want to avoid surfacing duplicates.
                // So, rank a result with viewTitleIndexWithinExplorer=0 way more highly than one with 1, 2, etc.
                "asc(viewTitleIndexWithinExplorer)",
                "asc(titleLength)",
            ],
            attributesToSnippet: ["subtitle:24"],
            attributeForDistinct: "id",
            optionalWords: ["vs"],

            // These lines below essentially demote matches in the `subtitle` and `availableEntities` fields:
            // If we find a match (only) there, then it doesn't count towards `exact`, and is therefore ranked lower.
            // We also disable prefix matching and typo tolerance on these.
            disableExactOnAttributes: [
                "tags",
                "subtitle",
                "availableEntities",
                "originalAvailableEntities",
            ],
            disableTypoToleranceOnAttributes: [
                "subtitle",
                "availableEntities",
                "originalAvailableEntities",
            ],
            disablePrefixOnAttributes: ["subtitle"],
            attributesForFaceting: [
                "tags",
                "availableEntities",
                "type",
                "isIncomeGroupSpecificFM",
            ],
        },
    })

    const algoliaSynonyms = synonyms.map((s) => {
        return {
            objectID: s.join("-"),
            type: "synonym",
            synonyms: s,
        } as SynonymHit
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

    // Save synonyms for all indices
    for (const indexName of [
        chartsIndexName,
        pagesIndexName,
        explorerViewsAndChartsIndexName,
    ]) {
        await client.saveSynonyms({
            indexName,
            synonymHit: algoliaSynonyms,
            replaceExistingSynonyms: true,
        })
    }

    if (TOPICS_CONTENT_GRAPH) {
        const graphIndexName = CONTENT_GRAPH_ALGOLIA_INDEX

        await client.setSettings({
            indexName: graphIndexName,
            indexSettings: {
                attributesForFaceting: [
                    ...[...Array(5)].map(
                        (_, i) => `searchable(topics.lvl${i})`
                    ),
                    "searchable(type)",
                ],
            },
        })
    }
}

if (require.main === module) void configureAlgolia()
