import algoliasearch from "algoliasearch"
import { Synonym } from "@algolia/client-search"

import { ALGOLIA_ID } from "settings"
import { ALGOLIA_SECRET_KEY } from "serverSettings"
import { countries } from "utils/countries"

// This function initializes and applies settings to the Algolia search indices
// Algolia settings should be configured here rather than   in the Algolia dashboard UI, as then
// they are recorded and transferrable across dev/prod instances
export async function configureAlgolia() {
    const client = algoliasearch(ALGOLIA_ID, ALGOLIA_SECRET_KEY)
    const chartsIndex = client.initIndex("charts")

    await chartsIndex.setSettings({
        searchableAttributes: [
            "title",
            "unordered(variantName)",
            "unordered(subtitle)",
            "unordered(_tags)",
            "unordered(availableEntities)",
        ],
        ranking: ["exact", "typo", "attribute", "words", "proximity", "custom"],
        customRanking: ["asc(numDimensions)", "asc(titleLength)"],
        attributesToSnippet: ["subtitle:24"],
        attributeForDistinct: "id",
        alternativesAsExact: [
            "ignorePlurals",
            "singleWordSynonym",
            "multiWordsSynonym",
        ],
        exactOnSingleWordQuery: "none",
        disableExactOnAttributes: ["_tags"],
        optionalWords: ["vs"],
        removeStopWords: ["en"],
    })

    const pagesIndex = client.initIndex("pages")

    await pagesIndex.setSettings({
        searchableAttributes: [
            "unordered(title)",
            "unordered(content)",
            "unordered(_tags)",
            "unordered(authors)",
        ],
        ranking: ["exact", "typo", "attribute", "words", "proximity", "custom"],
        customRanking: ["desc(importance)"],
        attributesToSnippet: ["content:24"],
        attributeForDistinct: "slug",
        alternativesAsExact: [
            "ignorePlurals",
            "singleWordSynonym",
            "multiWordsSynonym",
        ],
        attributesForFaceting: ["searchable(_tags)", "searchable(authors)"],
        exactOnSingleWordQuery: "none",
        disableExactOnAttributes: ["_tags"],
        removeStopWords: ["en"],
    })

    const synonyms = [
        ["kids", "children"],
        ["pork", "pigmeat"],
        ["atomic", "nuclear"],
        ["pop", "population"],
        ["cheese", "dairy"],
        ["gdp", "economic growth"],
        ["overpopulation", "population growth"],
        ["covid", "covid-19", "coronavirus", "corona"],
        ["flu", "influenza"],
        ["co2", "CO₂", "carbon dioxide"],
        ["ch4", "CH₄", "methane"],
        ["n2o", "N₂O", "nitrous oxide"],
        ["NOx", "NOₓ", "nitrogen dioxide"],
    ]

    // Send all our country variant names to algolia as synonyms
    for (const country of countries) {
        if (country.variantNames) {
            synonyms.push([country.name].concat(country.variantNames))
        }
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
}

if (require.main === module) {
    configureAlgolia()
}
