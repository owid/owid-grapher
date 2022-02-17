import fs from "fs-extra"
import path from "path"
import fetch from "node-fetch"
import uniq from "lodash/uniq"

import * as db from "./db.js"

const SDG_TRACKER_PAGE_URLS: string[] = [
    "https://sdg-tracker.org/no-poverty",
    "https://sdg-tracker.org/zero-hunger",
    "https://sdg-tracker.org/good-health",
    "https://sdg-tracker.org/quality-education",
    "https://sdg-tracker.org/gender-equality",
    "https://sdg-tracker.org/water-and-sanitation",
    "https://sdg-tracker.org/energy",
    "https://sdg-tracker.org/economic-growth",
    "https://sdg-tracker.org/infrastructure-industrialization",
    "https://sdg-tracker.org/inequality",
    "https://sdg-tracker.org/cities",
    "https://sdg-tracker.org/sustainable-consumption-production",
    "https://sdg-tracker.org/climate-change",
    "https://sdg-tracker.org/oceans",
    "https://sdg-tracker.org/biodiversity",
    "https://sdg-tracker.org/peace-justice",
    "https://sdg-tracker.org/global-partnerships",
]

interface GrapherSlugReference {
    pageUrl: string
    grapherSlug: string
}

interface GrapherSlugAndIdReference extends GrapherSlugReference {
    grapherId: number | undefined
}

const reGrapherSlugs = /(?<=ourworldindata\.org\/grapher\/)([A-Za-z0-9\-\_]+)/g

const getSlugReferencesForAllPages = async (): Promise<
    GrapherSlugReference[]
> => {
    const result: GrapherSlugReference[] = []
    for (const pageUrl of SDG_TRACKER_PAGE_URLS) {
        // intentionally iterating one by one to avoid sending many requests at once
        const response = await fetch(pageUrl)
        const html = await response.text()
        const grapherSlugs = html.match(reGrapherSlugs)
        if (grapherSlugs)
            result.push(
                ...grapherSlugs
                    .map((grapherSlug) => ({ pageUrl, grapherSlug }))
                    // embedCharts.js is the Grapher library
                    .filter((ref) => !ref.grapherSlug.startsWith("embedCharts"))
            )
    }
    return result
}

const getReferencesForAllPages = async (): Promise<
    GrapherSlugAndIdReference[]
> => {
    const grapherSlugReferences = await getSlugReferencesForAllPages()
    const uniqSlugs: string[] = uniq(
        grapherSlugReferences.map((ref) => ref.grapherSlug)
    )
    const graphersWithIdAndSlug: { id: number; slug: string }[] =
        await db.queryMysql(
            `
            SELECT DISTINCT id, slug
            FROM (
                SELECT
                    id AS id,
                    config->>"$.slug" AS slug
                FROM charts
                WHERE config->>"$.slug" IN (?)

                UNION

                SELECT
                    chart_id AS id,
                    slug AS slug
                FROM chart_slug_redirects
                WHERE slug IN (?)
            ) t
            `,
            [uniqSlugs, uniqSlugs]
        )
    const grapherIdBySlug = new Map(
        graphersWithIdAndSlug.map((g) => [g.slug, g.id])
    )
    return grapherSlugReferences.map((ref) => ({
        ...ref,
        grapherId: grapherIdBySlug.get(ref.grapherSlug),
    }))
}

const main = async (): Promise<void> => {
    const references = await getReferencesForAllPages()
    await db.closeTypeOrmAndKnexConnections()
    const filePath = path.resolve(
        __dirname,
        "..",
        "..",
        "sdg-tracker.org-references.json"
    )
    await fs.writeFile(filePath, JSON.stringify(references))
    console.log(`Saved in ${filePath}`)
}

main()
