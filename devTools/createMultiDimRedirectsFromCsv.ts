import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import fs from "fs-extra"
import * as d3 from "d3-dsv"
import * as db from "../db/db.js"
import {
    ChartSlugRedirectsTableName,
    DbPlainMultiDimDataPage,
    DbPlainRedirect,
    DbPlainUser,
    MultiDimDataPagesTableName,
    MultiDimRedirectsTableName,
    UsersTableName,
} from "@ourworldindata/types"
import {
    extractMultiDimChoicesFromSearchParams,
    MultiDimDataPageConfig,
    Url,
} from "@ourworldindata/utils"
import { redirectWithSourceExists } from "../db/model/Redirect.js"
import { buildQueryStrFromConfig } from "../db/model/MultiDimRedirects.js"
import { getChartConfigBySlug } from "../db/model/Chart.js"
import { getUserById } from "../db/model/User.js"
import { saveGrapher } from "../adminSiteServer/apiRoutes/charts.js"

const sourcePattern = /^\/(grapher|explorers)\/.*[^/]$/

interface CsvRedirectEntry {
    lineNumber: number
    source: string
    target: string
    targetUrl: Url
    targetSlug: string
}

interface MultiDimInfo {
    id: number
    slug: string
    config: MultiDimDataPageConfig
}

interface MultiDimTarget {
    multiDimId: number
    viewConfigId: string | null
    targetBasePath: string
    targetFullPath: string
}

class DryRunRollback extends Error {}

function normalizePath(
    value: string,
    field: string,
    lineNumber: number
): string {
    const trimmed = value.trim()
    if (!trimmed) {
        throw new Error(`Line ${lineNumber}: Missing ${field}`)
    }
    if (!trimmed.startsWith("/")) {
        throw new Error(
            `Line ${lineNumber}: ${field} must start with '/' (got '${trimmed}')`
        )
    }
    const url = Url.fromURL(trimmed)
    if (!url.pathname) {
        throw new Error(
            `Line ${lineNumber}: ${field} is missing a pathname (got '${trimmed}')`
        )
    }
    return url.fullUrlNoTrailingSlash
}

function parseCsvEntries(rawContent: string): CsvRedirectEntry[] {
    const sanitizedContent = rawContent.replace(/^\uFEFF/, "")
    const rows = d3.dsvFormat(";").parseRows(sanitizedContent)
    const entries: CsvRedirectEntry[] = []
    const seenSources = new Set<string>()

    rows.forEach((row, index) => {
        const lineNumber = index + 1
        const rawSource = row[0]?.trim() ?? ""
        const rawTarget = row[1]?.trim() ?? ""
        if (!rawSource && !rawTarget) return
        if (!rawSource.startsWith("/") || !rawTarget.startsWith("/")) {
            if (index === 0) return
            throw new Error(
                `Line ${lineNumber}: Expected source and target paths starting with '/'`
            )
        }
        const source = normalizePath(rawSource, "source", lineNumber)
        const target = normalizePath(rawTarget, "target", lineNumber)
        if (seenSources.has(source)) {
            throw new Error(`Line ${lineNumber}: Duplicate source '${source}'`)
        }
        seenSources.add(source)
        const targetUrl = Url.fromURL(target)
        if (!targetUrl.pathname?.startsWith("/grapher/")) {
            throw new Error(
                `Line ${lineNumber}: Target must be a /grapher/ path (got '${target}')`
            )
        }
        const targetSlug = targetUrl.slug
        if (!targetSlug) {
            throw new Error(
                `Line ${lineNumber}: Unable to extract target slug from '${target}'`
            )
        }
        entries.push({
            lineNumber,
            source,
            target,
            targetUrl,
            targetSlug,
        })
    })

    if (entries.length === 0) {
        throw new Error("No redirects found in CSV")
    }

    return entries
}

function buildRedirectTargetFullPath(
    multiDim: MultiDimInfo,
    viewConfigId: string | null
): string {
    const queryStr = buildQueryStrFromConfig(
        viewConfigId,
        JSON.stringify(multiDim.config.config),
        multiDim.slug
    )
    return `/grapher/${multiDim.slug}${queryStr ? `?${queryStr}` : ""}`
}

function getViewConfigId(
    entry: CsvRedirectEntry,
    multiDim: MultiDimInfo
): string | null {
    const searchParams = new URLSearchParams(entry.targetUrl.queryStr)
    const dimensionChoices = extractMultiDimChoicesFromSearchParams(
        searchParams,
        multiDim.config
    )
    if (Object.keys(dimensionChoices).length === 0) {
        return null
    }
    try {
        const view = multiDim.config.findViewByDimensions(dimensionChoices)
        if (!view) {
            throw new Error(
                `No matching view for dimensions ${JSON.stringify(dimensionChoices)}`
            )
        }
        return view.fullConfigId
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(
                `Line ${entry.lineNumber}: ${error.message} for target '${entry.target}'`,
                { cause: error }
            )
        }
        throw error
    }
}

async function validatePathIsNotRedirectSource(
    trx: db.KnexReadonlyTransaction,
    path: string
): Promise<void> {
    if (await redirectWithSourceExists(trx, path)) {
        throw new Error(
            `'${path}' is already a source of an existing site redirect`
        )
    }
    const existingMultiDimRedirect = await trx<{ id: number }>(
        MultiDimRedirectsTableName
    )
        .select("id")
        .where("source", path)
        .first()
    if (existingMultiDimRedirect) {
        throw new Error(
            `'${path}' is already a source of an existing multi-dim redirect`
        )
    }
    const slug = Url.fromURL(path).slug
    if (!slug) return
    const existingChartSlugRedirect = await trx<{ id: number }>(
        ChartSlugRedirectsTableName
    )
        .select("id")
        .where("slug", slug)
        .first()
    if (existingChartSlugRedirect) {
        throw new Error(
            `'${path}' is already a source of an existing chart slug redirect`
        )
    }
}

async function replaceSiteRedirects(
    trx: db.KnexReadWriteTransaction,
    source: string,
    targetFullPath: string
): Promise<void> {
    const siteRedirects = await trx<DbPlainRedirect>("redirects")
        .select("id", "source", "target", "code", "ttl")
        .where("target", source)

    for (const redirect of siteRedirects) {
        if (redirect.source === targetFullPath) {
            console.log(
                `Deleting self-referential site redirect ${redirect.source} -> ${redirect.target}`
            )
            await trx("redirects").where({ id: redirect.id }).delete()
            continue
        }
        console.log(
            `Replacing site redirect ${redirect.source} -> ${redirect.target} with ${targetFullPath}`
        )
        await trx("redirects").where({ id: redirect.id }).delete()
        await trx("redirects").insert({
            source: redirect.source,
            target: targetFullPath,
            code: redirect.code,
            ttl: redirect.ttl ?? null,
        })
    }
}

async function replaceMultiDimRedirects(
    trx: db.KnexReadWriteTransaction,
    source: string,
    target: MultiDimTarget
): Promise<void> {
    if (!source.startsWith("/grapher/")) return
    const sourceSlug = Url.fromURL(source).slug
    if (!sourceSlug) return
    const redirects = await db.knexRaw<{ id: number; source: string }>(
        trx,
        `-- sql
        SELECT mdr.id, mdr.source
        FROM ${MultiDimRedirectsTableName} mdr
        JOIN ${MultiDimDataPagesTableName} mdp ON mdr.multiDimId = mdp.id
        WHERE mdp.slug = ?`,
        [sourceSlug]
    )

    for (const redirect of redirects) {
        if (redirect.source === target.targetBasePath) {
            console.log(
                `Deleting multi-dim redirect ${redirect.source} because it matches the target base path`
            )
            await trx(MultiDimRedirectsTableName)
                .where({ id: redirect.id })
                .delete()
            continue
        }
        if (redirect.source === target.targetFullPath) {
            console.log(
                `Deleting self-referential multi-dim redirect ${redirect.source}`
            )
            await trx(MultiDimRedirectsTableName)
                .where({ id: redirect.id })
                .delete()
            continue
        }
        console.log(
            `Replacing multi-dim redirect ${redirect.source} with ${target.targetFullPath}`
        )
        await trx(MultiDimRedirectsTableName)
            .where({ id: redirect.id })
            .delete()
        await validatePathIsNotRedirectSource(trx, redirect.source)
        await trx(MultiDimRedirectsTableName).insert({
            source: redirect.source,
            multiDimId: target.multiDimId,
            viewConfigId: target.viewConfigId,
        })
    }
}

async function replaceChartSlugRedirects(
    trx: db.KnexReadWriteTransaction,
    source: string,
    target: MultiDimTarget
): Promise<void> {
    if (!source.startsWith("/grapher/")) return
    const sourceSlug = Url.fromURL(source).slug
    if (!sourceSlug) return
    const redirects = await db.knexRaw<{ id: number; slug: string }>(
        trx,
        `-- sql
        SELECT csr.id, csr.slug
        FROM ${ChartSlugRedirectsTableName} csr
        JOIN charts c ON csr.chart_id = c.id
        JOIN chart_configs cc ON c.configId = cc.id
        WHERE cc.slug = ?`,
        [sourceSlug]
    )

    for (const redirect of redirects) {
        const redirectSource = `/grapher/${redirect.slug}`
        if (redirectSource === target.targetBasePath) {
            console.log(
                `Deleting chart slug redirect ${redirectSource} because it matches the target base path`
            )
            await trx(ChartSlugRedirectsTableName)
                .where({ id: redirect.id })
                .delete()
            continue
        }
        if (redirectSource === target.targetFullPath) {
            console.log(
                `Deleting self-referential chart slug redirect ${redirectSource}`
            )
            await trx(ChartSlugRedirectsTableName)
                .where({ id: redirect.id })
                .delete()
            continue
        }
        console.log(
            `Replacing chart slug redirect ${redirectSource} with ${target.targetFullPath}`
        )
        await trx(ChartSlugRedirectsTableName)
            .where({ id: redirect.id })
            .delete()
        await validatePathIsNotRedirectSource(trx, redirectSource)
        await trx(MultiDimRedirectsTableName).insert({
            source: redirectSource,
            multiDimId: target.multiDimId,
            viewConfigId: target.viewConfigId,
        })
    }
}

async function replaceChainedRedirects(
    trx: db.KnexReadWriteTransaction,
    source: string,
    target: MultiDimTarget
): Promise<void> {
    await replaceSiteRedirects(trx, source, target.targetFullPath)
    await replaceMultiDimRedirects(trx, source, target)
    await replaceChartSlugRedirects(trx, source, target)
}

async function loadMultiDims(
    trx: db.KnexReadWriteTransaction,
    slugs: string[]
): Promise<Map<string, MultiDimInfo>> {
    const rows = await trx<DbPlainMultiDimDataPage>(MultiDimDataPagesTableName)
        .select("id", "slug", "config", "published")
        .whereIn("slug", slugs)

    const multiDims = new Map<string, MultiDimInfo>()
    for (const row of rows) {
        if (!row.slug) continue
        const config = MultiDimDataPageConfig.fromObject(JSON.parse(row.config))
        if (!row.published) {
            throw new Error(`Multi-dim '${row.slug}' is not published`)
        }
        multiDims.set(row.slug, {
            id: row.id,
            slug: row.slug,
            config,
        })
    }

    return multiDims
}

function getChartSlugsToUnpublish(entries: CsvRedirectEntry[]): string[] {
    const slugs = new Set<string>()
    for (const entry of entries) {
        if (!entry.source.startsWith("/grapher/")) continue
        const slug = Url.fromURL(entry.source).slug
        if (slug) slugs.add(slug)
    }
    return Array.from(slugs)
}

async function resolveUser(
    trx: db.KnexReadWriteTransaction,
    userId?: number
): Promise<DbPlainUser> {
    if (userId !== undefined) {
        const user = await getUserById(trx, userId)
        if (!user) {
            throw new Error(`User with id ${userId} not found`)
        }
        console.log(`Using user ${user.id} (${user.email}) for unpublishing`)
        return user
    }

    const fallbackUser = await trx<DbPlainUser>(UsersTableName)
        .where({ email: "admin@example.com" })
        .first()

    if (!fallbackUser) {
        throw new Error(
            "Admin user with email admin@example.com not found; pass --user-id"
        )
    }

    console.log(
        `Using user ${fallbackUser.id} (${fallbackUser.email}) for unpublishing`
    )
    return fallbackUser
}

async function unpublishChartsForSources(
    trx: db.KnexReadWriteTransaction,
    chartSlugs: string[],
    user: DbPlainUser | undefined,
    dryRun: boolean
): Promise<void> {
    if (chartSlugs.length === 0) return
    if (!dryRun && !user) {
        throw new Error("User is required to unpublish charts")
    }

    for (const slug of chartSlugs) {
        let chartConfig: Awaited<ReturnType<typeof getChartConfigBySlug>>
        try {
            chartConfig = await getChartConfigBySlug(trx, slug)
        } catch (error) {
            if (error instanceof Error && error.message.includes("No chart")) {
                console.warn(
                    `No chart found for slug '${slug}', skipping unpublish`
                )
                continue
            }
            throw error
        }

        if (!chartConfig.config.isPublished) {
            console.log(`Chart '${slug}' already unpublished, skipping`)
            continue
        }

        if (dryRun) {
            console.log(`Dry run: would unpublish chart '${slug}'`)
            continue
        }

        console.log(`Unpublishing chart '${slug}'`)
        const newConfig = {
            ...chartConfig.config,
            isPublished: false,
        }
        await saveGrapher(trx, {
            user: user as DbPlainUser,
            newConfig,
            existingConfig: chartConfig.config,
        })
    }
}

function parseArguments(): {
    csvPath: string
    dryRun: boolean
    userId?: number
} {
    const parser = yargs(hideBin(process.argv))
        .scriptName("createMultiDimRedirectsFromCsv.ts")
        .usage("$0 <csv> [--dry-run] [--user-id <id>]")
        .command("$0 <csv>", false)
        .positional("csv", {
            type: "string",
            describe: "CSV file with source and target columns",
        })
        .option("dry-run", {
            type: "boolean",
            default: false,
            describe: "Roll back the transaction after processing",
        })
        .option("user-id", {
            type: "number",
            describe: "User id to attribute chart unpublishing",
        })
        .parserConfiguration({ "camel-case-expansion": true })
        .help()

    const args = parser.parseSync()

    return {
        csvPath: args.csv as string,
        dryRun: args.dryRun,
        userId: args.userId,
    }
}

async function main(): Promise<void> {
    const { csvPath, dryRun, userId } = parseArguments()

    const rawContent = await fs.readFile(csvPath, "utf8")
    const entries = parseCsvEntries(rawContent)
    console.log(`Loaded ${entries.length} redirects from ${csvPath}`)
    if (dryRun) {
        console.log("Dry run enabled; transaction will be rolled back.")
    }

    const uniqueTargetSlugs = Array.from(
        new Set(entries.map((entry) => entry.targetSlug))
    )
    const chartSlugsToUnpublish = getChartSlugsToUnpublish(entries)

    try {
        await db.knexReadWriteTransaction(async (trx) => {
            const multiDims = await loadMultiDims(trx, uniqueTargetSlugs)

            for (const entry of entries) {
                const multiDim = multiDims.get(entry.targetSlug)
                if (!multiDim) {
                    throw new Error(
                        `Line ${entry.lineNumber}: Multi-dim slug '${entry.targetSlug}' not found`
                    )
                }
                if (!sourcePattern.test(entry.source)) {
                    throw new Error(
                        `Line ${entry.lineNumber}: Source must start with /grapher/ or /explorers/ and cannot end with a slash`
                    )
                }

                const viewConfigId = getViewConfigId(entry, multiDim)
                const targetFullPath = buildRedirectTargetFullPath(
                    multiDim,
                    viewConfigId
                )
                const target: MultiDimTarget = {
                    multiDimId: multiDim.id,
                    viewConfigId,
                    targetBasePath: `/grapher/${multiDim.slug}`,
                    targetFullPath,
                }

                if (entry.source === target.targetBasePath) {
                    throw new Error(
                        `Line ${entry.lineNumber}: Redirect source matches target base path '${target.targetBasePath}'`
                    )
                }

                await validatePathIsNotRedirectSource(trx, entry.source)
                await validatePathIsNotRedirectSource(
                    trx,
                    target.targetBasePath
                )

                await replaceChainedRedirects(trx, entry.source, target)

                console.log(
                    `Creating multi-dim redirect ${entry.source} -> ${target.targetFullPath}`
                )
                await trx(MultiDimRedirectsTableName).insert({
                    source: entry.source,
                    multiDimId: target.multiDimId,
                    viewConfigId: target.viewConfigId,
                })
            }

            const user =
                chartSlugsToUnpublish.length > 0 && !dryRun
                    ? await resolveUser(trx, userId)
                    : undefined

            await unpublishChartsForSources(
                trx,
                chartSlugsToUnpublish,
                user,
                dryRun
            )

            if (dryRun) {
                throw new DryRunRollback()
            }
        }, db.TransactionCloseMode.Close)
    } catch (error) {
        if (dryRun && error instanceof DryRunRollback) {
            console.log("Dry run complete; no changes committed.")
            return
        }
        throw error
    }
}

void main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })
