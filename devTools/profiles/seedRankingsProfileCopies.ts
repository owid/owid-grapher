// Seeds ranking-enhanced COPIES of the published profile templates (co2,
// energy, population-demography, health) into the local dev DB. The original
// rows are never modified: each copy gets id `<originalId>-rankings` and slug
// `<slug>-rankings`, and has ranking-cards / peer-ranking / peer-comparison
// blocks inserted at fixed anchor blocks. Prototype helper: view the copies at
// /profile/<slug>-rankings/germany on the admin server.
//
// Usage: yarn tsx --tsconfig tsconfig.tsx.json devTools/profiles/seedRankingsProfileCopies.ts [--delete]

import { archieToEnriched } from "@ourworldindata/gdoc-pipeline"
import {
    OwidEnrichedGdocBlock,
    OwidGdocType,
    PostsGdocsTableName,
    PostsGdocsXTagsTableName,
} from "@ourworldindata/types"
import * as db from "../../db/db.js"
import { GdocProfile } from "../../db/model/Gdoc/GdocProfile.js"
import {
    getAndLoadGdocBySlug,
    upsertGdoc,
} from "../../db/model/Gdoc/GdocFactory.js"

const ID_SUFFIX = "-rankings"
const SLUG_SUFFIX = "-rankings"
const TITLE_SUFFIX = " (rankings prototype)"

const grapher = (slugAndQuery: string): string =>
    `https://ourworldindata.org/grapher/${slugAndQuery}`
const popExplorer = (indicator: string): string =>
    `https://ourworldindata.org/explorers/population-and-demography?indicator=${indicator}&Sex=Both+sexes&Age=Total&Projection+scenario=None&country=$entityCode&hideControls=true`

interface Anchor {
    /** Expected 0-based index in the original body (or container content) */
    index: number
    type: string
    /** Substring that must appear in the block's url */
    url?: string
    /** Substring that must appear in the block's (heading) text */
    text?: string
}

interface Insertion {
    /** Insert immediately after this block */
    after: Anchor
    /** If set, `after` is resolved inside this container block's `content` */
    inside?: Anchor
    archie: string
}

interface ProfileSpec {
    slug: string
    insertions: Insertion[]
}

const SPECS: ProfileSpec[] = [
    {
        slug: "co2",
        insertions: [
            {
                after: {
                    index: 2,
                    type: "cta",
                    url: "topics=CO2+%26+Greenhouse+Gas+Emissions",
                },
                archie: `
{.ranking-cards}
title: $EntityName at a glance
subtitle: Where $entityName ranks among all countries on key emissions metrics
sparklines: true
change-since: 10
[.cards]
url: ${grapher("co-emissions-per-capita?country=$entityCode")}
title: CO₂ emissions per person
topic: Emissions
sort: lowest
url: ${grapher("per-capita-ghg-emissions?tab=line&country=$entityCode")}
title: Greenhouse gas emissions per person
topic: Emissions
sort: lowest
url: ${grapher("annual-share-of-co2-emissions?country=$entityCode")}
title: Share of global CO₂ emissions
topic: Emissions
url: ${grapher("share-of-cumulative-co2?country=$entityCode")}
title: Share of global cumulative CO₂ emissions
topic: Emissions
[]
{}`,
            },
            {
                after: {
                    index: 3,
                    type: "data-callout",
                    url: "/grapher/co-emissions-per-capita?country=$entityCode",
                },
                archie: `
{.peer-ranking}
url: ${grapher("co-emissions-per-capita?country=$entityCode")}
title: CO₂ emissions per person compared with $entityName’s peers
sort: lowest
{}`,
            },
            {
                after: {
                    index: 15,
                    type: "data-callout",
                    url: "/grapher/energy-mix?metric=carbon_intensity",
                },
                archie: `
{.peer-comparison}
title: How $entityName’s emissions compare with its peers
[.indicators]
url: ${grapher("co-emissions-per-capita?country=$entityCode")}
title: CO₂ per person
url: ${grapher("per-capita-ghg-emissions?tab=line&country=$entityCode")}
title: Greenhouse gases per person
url: ${grapher("per-capita-methane-emissions?country=$entityCode")}
title: Methane per person
url: ${grapher("per-capita-nitrous-oxide?tab=line&country=$entityCode")}
title: Nitrous oxide per person
url: ${grapher("energy-intensity?tab=line&country=$entityCode")}
title: Energy intensity (energy per unit of GDP)
url: ${grapher("energy-mix?metric=carbon_intensity&source=total&country=$entityCode&tab=line&hideControls=true")}
title: Carbon intensity of energy
[]
{}`,
            },
        ],
    },
    {
        slug: "energy",
        insertions: [
            {
                after: { index: 4, type: "cta", url: "topics=Energy" },
                archie: `
{.ranking-cards}
title: $EntityName at a glance
subtitle: Where $entityName ranks among all countries with data on key energy metrics
sparklines: true
change-since: 10
[.cards]
url: ${grapher("energy-mix?metric=per_capita&source=total&country=$entityCode&tab=line&hideControls=true")}
title: Energy consumption per person
topic: Energy
url: ${grapher("electricity-mix?frequency=annual&metric=per_capita&source=total&country=$entityCode&tab=line&hideControls=true")}
title: Electricity generation per person
topic: Electricity
url: ${grapher("energy-mix?metric=share&source=fossil_fuels&country=$entityCode&tab=line&hideControls=true")}
title: Share of energy from fossil fuels
topic: Energy
sort: lowest
url: ${grapher("electricity-mix?frequency=annual&metric=share_of_generation&source=low_carbon&country=$entityCode&tab=line&hideControls=true")}
title: Share of electricity from low-carbon sources
topic: Electricity
url: ${grapher("energy-mix?metric=carbon_intensity&source=total&country=$entityCode&tab=line&hideControls=true")}
title: Carbon intensity of energy
topic: Emissions
sort: lowest
[]
{}`,
            },
            {
                inside: { index: 5, type: "conditional-section" },
                after: {
                    index: 3,
                    type: "chart",
                    url: "/grapher/share-of-the-population-with-access-to-electricity",
                },
                archie: `
{.peer-ranking}
url: ${grapher("share-of-the-population-with-access-to-electricity?tab=line&country=$entityCode")}
title: Access to electricity compared with $entityName’s peers
{}`,
            },
            {
                after: { index: 12, type: "list" },
                archie: `
{.peer-ranking}
url: ${grapher("energy-mix?metric=per_capita&source=total&country=$entityCode&tab=line&hideControls=true")}
title: Energy consumption per person compared with $entityName’s peers
{}`,
            },
            {
                after: {
                    index: 90,
                    type: "chart",
                    url: "/grapher/electricity-mix?frequency=annual&metric=share_of_generation&source=nuclear",
                },
                archie: `
{.peer-comparison}
title: How $entityName’s electricity mix compares with its peers
[.indicators]
url: ${grapher("electricity-mix?frequency=annual&metric=share_of_generation&source=fossil&country=$entityCode&tab=line&hideControls=true")}
title: Fossil fuels (% of electricity)
url: ${grapher("electricity-mix?frequency=annual&metric=share_of_generation&source=low_carbon&country=$entityCode&tab=line&hideControls=true")}
title: Low-carbon sources (% of electricity)
url: ${grapher("electricity-mix?frequency=annual&metric=share_of_generation&source=renewables&country=$entityCode&tab=line&hideControls=true")}
title: Renewables (% of electricity)
url: ${grapher("electricity-mix?frequency=annual&metric=share_of_generation&source=nuclear&country=$entityCode&tab=line&hideControls=true")}
title: Nuclear (% of electricity)
[]
{}`,
            },
        ],
    },
    {
        slug: "population-demography",
        insertions: [
            {
                after: {
                    index: 3,
                    type: "cta",
                    url: "topics=Population+Growth",
                },
                archie: `
{.ranking-cards}
title: $EntityName at a glance
subtitle: Where $entityName ranks among all countries on key demographic indicators
sparklines: true
change-since: 10
[.cards]
url: ${popExplorer("Population")}&time=1800..latest
title: Population
topic: Population
url: ${popExplorer("Population+density")}
title: Population density
topic: Population
url: ${grapher("children-born-per-woman?country=$entityCode")}
title: Fertility rate
topic: Births
url: ${grapher("life-expectancy?country=$entityCode")}
title: Life expectancy
topic: Deaths
url: ${popExplorer("Median+age")}
title: Median age
topic: Age structure
[]
{}`,
            },
            {
                after: {
                    index: 9,
                    type: "data-callout",
                    url: "/grapher/children-born-per-woman?country=$entityCode",
                },
                archie: `
{.peer-ranking}
url: ${grapher("children-born-per-woman?country=$entityCode")}
title: Fertility rate compared with $entityName’s peers
{}`,
            },
            {
                after: {
                    index: 20,
                    type: "data-callout",
                    url: "/grapher/age-dependency-ratio-of-working-age-population",
                },
                archie: `
{.peer-comparison}
title: How $entityName’s demography compares with its peers
[.indicators]
url: ${popExplorer("Population+density")}
title: Population density
url: ${grapher("children-born-per-woman?country=$entityCode")}
title: Fertility rate
url: ${grapher("life-expectancy?country=$entityCode")}
title: Life expectancy
url: ${grapher("child-mortality-igme?tab=line&country=$entityCode")}
title: Child mortality
url: ${popExplorer("Population+growth+rate")}
title: Population growth rate
url: ${popExplorer("Median+age")}
title: Median age
url: ${grapher("age-dependency-ratio-of-working-age-population?tab=line&country=$entityCode")}
title: Age dependency ratio
[]
{}`,
            },
        ],
    },
    {
        slug: "health",
        insertions: [
            {
                after: { index: 2, type: "cta", url: "topics=Global+Health" },
                archie: `
{.ranking-cards}
title: $EntityName at a glance
subtitle: Where $entityName ranks among all countries on key health indicators
sparklines: true
change-since: 10
[.cards]
url: ${grapher("life-expectancy?country=$entityCode")}
title: Life expectancy
topic: Life expectancy
url: ${grapher("child-mortality-igme?tab=line&country=$entityCode")}
title: Child mortality
topic: Child health
sort: lowest
url: ${grapher("maternal-mortality?tab=line&country=$entityCode")}
title: Maternal mortality
topic: Maternal health
sort: lowest
url: ${grapher("annual-healthcare-expenditure-per-capita?tab=line&country=$entityCode")}
title: Healthcare spending per person
topic: Healthcare
[]
{}`,
            },
            {
                after: {
                    index: 14,
                    type: "data-callout",
                    url: "/grapher/life-expectancy?country=$entityCode",
                },
                archie: `
{.peer-ranking}
url: ${grapher("life-expectancy?country=$entityCode")}
title: Life expectancy compared with $entityName’s peers
{}`,
            },
            {
                after: {
                    index: 28,
                    type: "data-callout",
                    url: "/grapher/pm25-air-pollution",
                },
                archie: `
{.peer-comparison}
title: How $entityName’s health risk factors compare with its peers
[.indicators]
url: ${grapher("share-of-adults-who-smoke?tab=line&country=$entityCode")}
title: Adults who smoke
url: ${grapher("share-of-adults-who-are-overweight?tab=line&country=$entityCode")}
title: Adults who are overweight
url: ${grapher("pm25-air-pollution?tab=line&country=$entityCode")}
title: PM2.5 air pollution exposure
url: ${grapher("share-of-children-younger-than-5-who-suffer-from-stunting?tab=line&country=$entityCode")}
title: Children under 5 who are stunted
[]
{}`,
            },
        ],
    },
]

function blockText(block: OwidEnrichedGdocBlock): string {
    if ("text" in block && Array.isArray(block.text))
        return JSON.stringify(block.text)
    if ("text" in block && typeof block.text === "string") return block.text
    return ""
}

function assertAnchor(
    blocks: OwidEnrichedGdocBlock[],
    anchor: Anchor,
    context: string
): number {
    const describe = `${context}: anchor ${anchor.type}#${anchor.index}${anchor.url ? ` url~"${anchor.url}"` : ""}${anchor.text ? ` text~"${anchor.text}"` : ""}`
    const matches = (block: OwidEnrichedGdocBlock): boolean =>
        block.type === anchor.type &&
        (!anchor.url ||
            ("url" in block &&
                typeof block.url === "string" &&
                block.url.includes(anchor.url))) &&
        (!anchor.text || blockText(block).includes(anchor.text))
    const block = blocks[anchor.index]
    if (!block || !matches(block)) {
        const foundAt = blocks.findIndex(matches)
        throw new Error(
            `${describe} not found at expected index` +
                (foundAt >= 0
                    ? ` (a matching block exists at ${foundAt}; the source doc has changed)`
                    : " (no matching block found)")
        )
    }
    return anchor.index
}

function collectParseErrors(value: unknown, out: string[] = []): string[] {
    if (Array.isArray(value)) {
        for (const item of value) collectParseErrors(item, out)
    } else if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
            if (key === "parseErrors" && Array.isArray(child)) {
                for (const err of child) out.push(JSON.stringify(err))
            } else collectParseErrors(child, out)
        }
    }
    return out
}

function parseBlocks(archie: string, context: string): OwidEnrichedGdocBlock[] {
    const doc = new GdocProfile("parse-only")
    const content = archieToEnriched(
        `type: profile\ntitle: parse only\n\n[+body]\n${archie}\n[]\n`,
        doc._enrichSubclassContent
    )
    const blocks = content.body ?? []
    const errors = collectParseErrors(blocks)
    if (errors.length)
        throw new Error(`${context}: parse errors:\n${errors.join("\n")}`)
    if (blocks.length === 0)
        throw new Error(`${context}: snippet produced no blocks`)
    return blocks
}

function applyInsertions(
    body: OwidEnrichedGdocBlock[],
    spec: ProfileSpec
): void {
    // Resolve and validate all anchors against the unmodified body first, then
    // insert from the bottom up so that earlier insertions don't shift later
    // anchors.
    const resolved = spec.insertions.map((insertion, i) => {
        const context = `${spec.slug} insertion ${i + 1}`
        let container = body
        let containerIndex = -1
        if (insertion.inside) {
            containerIndex = assertAnchor(body, insertion.inside, context)
            const parent = body[containerIndex] as { content?: unknown }
            if (!Array.isArray(parent.content))
                throw new Error(`${context}: container has no content array`)
            container = parent.content as OwidEnrichedGdocBlock[]
        }
        const afterIndex = assertAnchor(container, insertion.after, context)
        return {
            container,
            sortKey: containerIndex >= 0 ? containerIndex : afterIndex,
            afterIndex,
            blocks: parseBlocks(insertion.archie, context),
        }
    })
    resolved.sort((a, b) => b.sortKey - a.sortKey)
    for (const r of resolved)
        r.container.splice(r.afterIndex + 1, 0, ...r.blocks)
}

async function main(): Promise<void> {
    const shouldDelete = process.argv.includes("--delete")
    await db.knexReadWriteTransaction(async (trx) => {
        for (const spec of SPECS) {
            const source = await getAndLoadGdocBySlug(trx, spec.slug, [
                OwidGdocType.Profile,
            ])
            if (!(source instanceof GdocProfile))
                throw new Error(`${spec.slug} is not a profile`)
            const copyId = `${source.id}${ID_SUFFIX}`
            const copySlug = `${spec.slug}${SLUG_SUFFIX}`

            if (shouldDelete) {
                await trx(PostsGdocsXTagsTableName)
                    .where({ gdocId: copyId })
                    .delete()
                await trx(PostsGdocsTableName).where({ id: copyId }).delete()
                console.log(`Deleted ${copyId}`)
                continue
            }

            const copy = new GdocProfile(copyId)
            copy.content = structuredClone(source.content)
            copy.content.title = `${source.content.title ?? spec.slug}${TITLE_SUFFIX}`
            applyInsertions(copy.content.body ?? [], spec)
            copy.slug = copySlug
            copy.published = true
            copy.publicationContext = source.publicationContext
            copy.publishedAt = source.publishedAt ?? new Date()
            copy.createdAt = new Date()
            copy.updatedAt = new Date()
            copy.revisionId = null
            await upsertGdoc(trx, copy)

            // Copy the tags so that breadcrumbs etc. match the original
            const tagIds = (source.tags ?? []).map((tag) => tag.id)
            await trx(PostsGdocsXTagsTableName)
                .where({ gdocId: copyId })
                .delete()
            if (tagIds.length)
                await trx(PostsGdocsXTagsTableName).insert(
                    tagIds.map((tagId) => ({ gdocId: copyId, tagId }))
                )

            console.log(
                `Upserted ${copyId}. View at /profile/${copySlug}/germany on the admin server.`
            )
        }
    }, db.TransactionCloseMode.Close)
}

void main()
