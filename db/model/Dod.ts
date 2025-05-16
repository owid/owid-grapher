import {
    DbPlainDod,
    DetailDictionary,
    EnrichedDetail,
    PostsGdocsLinksTableName,
    PostsGdocsTableName,
    ContentGraphLinkType,
    ExplorersTableName,
    ChartConfigsTableName,
    VariablesTableName,
    DodsTableName,
    DodUsageRecord,
} from "@ourworldindata/types"
import { extractDetailsFromSyntax } from "@ourworldindata/utils"
import { KnexReadonlyTransaction, knexRaw } from "../db.js"

export async function getDods(
    knex: KnexReadonlyTransaction
): Promise<DbPlainDod[]> {
    return knexRaw<DbPlainDod>(
        knex,
        `-- sql
        SELECT * FROM dods
        ORDER BY updatedAt DESC`
    )
}

export async function getParsedDodsDictionary(
    knex: KnexReadonlyTransaction
): Promise<DetailDictionary> {
    const dods = await getDods(knex)
    const parsedDods: DetailDictionary = {}
    for (const dod of dods) {
        const parsedDod: EnrichedDetail = {
            id: dod.name,
            text: dod.content,
        }
        parsedDods[dod.name] = parsedDod
    }
    return parsedDods
}

/**
 * These 'usage' objects are maps of dod names to lists of places where the dod is referenced.
 * e.g. { gdp: [{ id: 'real-gdp-growth', title: 'Annual GDP growth', type: "grapher" }] }
 * where 'gdp' is the name of the dod and the property is an array of DodUsageRecord objects.
 * We find all the graphers that reference the gdp dod, and all the explorers, and the indicators, etc
 * then merge them all together
 **/
function mergeDodUsage(
    acc: Record<string, DodUsageRecord[]>,
    cur: Record<string, DodUsageRecord[]>
): Record<string, DodUsageRecord[]> {
    for (const [dod, usage] of Object.entries(cur)) {
        if (!acc[dod]) {
            acc[dod] = []
        }
        acc[dod].push(...usage)
    }
    return acc
}

/**
 * We store configs as strings and dods are always written in markdown like (blah)[#dod:dod-name]
 * So we can naively extract the dods from configs using regex without having to parse the whole config
 */
function extractDodUsageFromString(
    id: string,
    config: string,
    title: string,
    type: "explorer" | "grapher" | "indicator" | "dod"
): Record<string, DodUsageRecord[]> {
    const usage = {} as Record<string, DodUsageRecord[]>
    const dodReferences = extractDetailsFromSyntax(config)
    const uniqueDodReferences = new Set(dodReferences)
    for (const dodReference of uniqueDodReferences) {
        const existingUsage = usage[dodReference] || []
        const newUsageRecord = {
            id,
            title,
            type,
        } as DodUsageRecord
        usage[dodReference] = [...existingUsage, newUsageRecord]
    }

    return usage
}

export async function getDodsUsage(
    knex: KnexReadonlyTransaction
): Promise<Record<string, DodUsageRecord[]>> {
    const postsGdocsUsagePromise = knexRaw<{
        target: string
        usage: string
    }>(
        knex,
        `-- sql
        SELECT
            pgl.target,
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    "id", pgl.sourceId,
                    "title", pg.content->>"$.title",
                    "type", "gdoc"
                )
            ) AS "usage"
        FROM
            ${PostsGdocsLinksTableName} pgl
        JOIN ${PostsGdocsTableName} pg ON
            pgl.sourceId = pg.id
        WHERE
            linkType = "${ContentGraphLinkType.Dod}"
        AND target IS NOT NULL
        GROUP BY
            target`
    ).then((rows) =>
        rows.reduce(
            (acc, { target, usage }) => {
                acc[target] = JSON.parse(usage)
                return acc
            },
            {} as Record<string, DodUsageRecord[]>
        )
    )

    const explorerUsagePromise = knexRaw<{ slug: string; config: string }>(
        knex,
        `-- sql
        SELECT slug, config
        FROM ${ExplorersTableName}
        WHERE config LIKE "%#dod:%"
        AND isPublished = 1`
    ).then((rows) =>
        rows.reduce(
            (acc, cur) => {
                const { slug, config } = cur
                const parsedConfig = JSON.parse(config)
                const usage = extractDodUsageFromString(
                    slug,
                    config,
                    parsedConfig.explorerTitle,
                    "explorer"
                )
                return mergeDodUsage(acc, usage)
            },
            {} as Record<string, DodUsageRecord[]>
        )
    )

    const chartsUsagePromise = knexRaw<{ slug: string; config: string }>(
        knex,
        `-- sql
        SELECT slug, full AS config
        FROM ${ChartConfigsTableName}
        WHERE full LIKE "%#dod:%"
        AND full->>"$.isPublished" = "true"`
    ).then((rows) =>
        rows.reduce(
            (acc, cur) => {
                const { slug, config } = cur
                const parsedConfig = JSON.parse(config)
                const usage = extractDodUsageFromString(
                    slug,
                    config,
                    parsedConfig.title,
                    "grapher"
                )
                return mergeDodUsage(acc, usage)
            },
            {} as Record<string, DodUsageRecord[]>
        )
    )

    // This takes ~3 seconds
    const indicatorUsagePromise = knexRaw<{
        id: number
        name: string
        descriptionShort: string
    }>(
        knex,
        `-- sql
        SELECT id, name, descriptionShort
        FROM ${VariablesTableName}
        WHERE descriptionShort LIKE "%#dod:%"`
    ).then((rows) => {
        return rows.reduce(
            (acc, cur) => {
                const { id, name, descriptionShort } = cur
                const usage = extractDodUsageFromString(
                    String(id),
                    descriptionShort,
                    name,
                    "indicator"
                )
                return mergeDodUsage(acc, usage)
            },
            {} as Record<string, DodUsageRecord[]>
        )
    })

    const dodUsagePromise = knexRaw<{ name: string; content: string }>(
        knex,
        `-- sql
        SELECT name, content FROM ${DodsTableName}
        WHERE content LIKE "%#dod:%"`
    ).then((rows) => {
        return rows.reduce(
            (acc, cur) => {
                const { name, content } = cur
                const usage = extractDodUsageFromString(
                    name,
                    content,
                    name,
                    "dod"
                )
                return mergeDodUsage(acc, usage)
            },
            {} as Record<string, DodUsageRecord[]>
        )
    })

    const results = await Promise.all([
        postsGdocsUsagePromise,
        explorerUsagePromise,
        chartsUsagePromise,
        indicatorUsagePromise,
        dodUsagePromise,
    ])

    return results.reduce(mergeDodUsage, {})
}
