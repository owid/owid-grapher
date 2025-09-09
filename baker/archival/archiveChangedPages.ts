// This should be imported as early as possible so the global error handler is
// set up before any errors are thrown.
import "../../serverUtils/instrument.js"

import * as Sentry from "@sentry/node"
import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import * as db from "../../db/db.js"
import {
    findChangedGrapherPages,
    findChangedMultiDimPages,
    findChangedExplorerPages,
    getGrapherChecksumsFromDb,
    getMultiDimChecksumsFromDb,
    getExplorerChecksumsFromDb,
    insertChartVersions,
    insertMultiDimVersions,
    insertExplorerVersions,
} from "../../db/model/archival/archivalDb.js"
import {
    GrapherChecksumsObjectWithHash,
    MultiDimChecksumsObjectWithHash,
    ExplorerChecksumsObjectWithHash,
} from "@ourworldindata/types"
import {
    getDateForArchival,
    getAllVariableIds,
    MultiDimDataPagesTableName,
    DbPlainMultiDimDataPage,
    MultiDimDataPageConfigEnriched,
    ArchivalTimestamp,
    OwidChartDimensionInterface,
    AssetMap,
} from "@ourworldindata/utils"
import { getEnrichedChartsByIds } from "../../db/model/Chart.js"
import {
    bakeArchivalGrapherPagesToFolder,
    bakeArchivalMultiDimPagesToFolder,
    bakeArchivalExplorerPagesToFolder,
    copyToLatestDir,
    generateChartVersionsFiles,
    generateMultiDimVersionsFiles,
    generateExplorerVersionsFiles,
    createCommonArchivalContext,
    archiveVariableIds,
    archiveChartConfigs,
    CommonArchivalContext,
    MinimalMultiDimInfo,
    MinimalChartInfo,
} from "./ArchivalBaker.js"
import { ExplorerAdminServer } from "../../explorerAdminServer/ExplorerAdminServer.js"
import { ExplorerProgram } from "@ourworldindata/explorer"

interface Options {
    dir: string
    latestDir?: boolean
    dryRun?: boolean
    chartIds?: number[]
    multiDimIds?: number[]
    explorerSlugs?: string[]
    type: "charts" | "multiDims" | "explorers" | "all"
}

interface ArchivalData {
    graphersToArchive: GrapherChecksumsObjectWithHash[]
    multiDimsToArchive: MultiDimChecksumsObjectWithHash[]
    explorersToArchive: ExplorerChecksumsObjectWithHash[]
    grapherConfigs: MinimalChartInfo[]
    multiDimConfigs: MinimalMultiDimInfo[]
    explorerPrograms: ExplorerProgram[]
}

/**
 * Fetches multi-dimensional page configurations from the database
 */
const getMultiDimConfigs = async (
    trx: db.KnexReadonlyTransaction,
    multiDimsToArchive: MultiDimChecksumsObjectWithHash[]
) => {
    const multiDimIds = multiDimsToArchive.map(
        (multiDim) => multiDim.multiDimId
    )
    const rawMultiDimConfigs = await trx<DbPlainMultiDimDataPage>(
        MultiDimDataPagesTableName
    )
        .select("id", "slug", "config")
        .whereIn("id", multiDimIds)
        .where("published", true)

    return rawMultiDimConfigs.map((row) => ({
        ...row,
        slug: row.slug!, // Published multi-dims must have a slug.
        config: JSON.parse(row.config) as MultiDimDataPageConfigEnriched,
    }))
}

const getExplorerPrograms = async (
    trx: db.KnexReadonlyTransaction,
    explorersToArchive: ExplorerChecksumsObjectWithHash[]
) => {
    const explorerServer = new ExplorerAdminServer()
    const bySlug = await explorerServer.getAllPublishedExplorersBySlug(trx)
    return explorersToArchive.map((exp) => bySlug[exp.explorerSlug])
}

/**
 * Determines which explorers need to be archived based on options
 */
const getExplorersToArchive = async (
    trx: db.KnexReadWriteTransaction,
    opts: Options
): Promise<ExplorerChecksumsObjectWithHash[]> => {
    const shouldProcessExplorers =
        opts.type === "explorers" || opts.type === "all"

    if (!shouldProcessExplorers) {
        return []
    }

    if (opts.explorerSlugs?.length) {
        console.log(
            "Archiving only the following explorer slugs:",
            opts.explorerSlugs.join(", ")
        )

        const allChecksums = await getExplorerChecksumsFromDb(trx)
        const explorersToArchive = allChecksums.filter((checksum) =>
            opts.explorerSlugs?.includes(checksum.explorerSlug)
        )

        if (opts.explorerSlugs.length !== explorersToArchive.length) {
            throw new Error(
                `Not all explorer slugs were found in the database. Found ${explorersToArchive.length} out of ${opts.explorerSlugs.length}.`
            )
        }

        return explorersToArchive
    }

    return await findChangedExplorerPages(trx)
}

/**
 * Determines which graphers need to be archived based on options
 */
const getGraphersToArchive = async (
    trx: db.KnexReadWriteTransaction,
    opts: Options
): Promise<GrapherChecksumsObjectWithHash[]> => {
    const shouldProcessGraphers = opts.type === "charts" || opts.type === "all"

    if (!shouldProcessGraphers) {
        return []
    }

    if (opts.chartIds?.length) {
        console.log(
            "Archiving only the following chart IDs:",
            opts.chartIds.join(", ")
        )

        const allChecksums = await getGrapherChecksumsFromDb(trx)
        const graphersToArchive = allChecksums.filter((checksum) =>
            opts.chartIds?.includes(checksum.chartId)
        )

        if (opts.chartIds.length !== graphersToArchive.length) {
            throw new Error(
                `Not all chart IDs were found in the database. Found ${graphersToArchive.length} out of ${opts.chartIds.length}.`
            )
        }

        return graphersToArchive
    }

    return await findChangedGrapherPages(trx)
}

/**
 * Determines which multi-dimensional pages need to be archived based on options
 */
const getMultiDimsToArchive = async (
    trx: db.KnexReadWriteTransaction,
    opts: Options
): Promise<MultiDimChecksumsObjectWithHash[]> => {
    const shouldProcessMultiDims =
        opts.type === "multiDims" || opts.type === "all"

    if (!shouldProcessMultiDims) {
        return []
    }

    if (opts.multiDimIds?.length) {
        console.log(
            "Archiving only the following multi-dim IDs:",
            opts.multiDimIds.join(", ")
        )

        const allChecksums = await getMultiDimChecksumsFromDb(trx)
        const multiDimsToArchive = allChecksums.filter((checksum) =>
            opts.multiDimIds?.includes(checksum.multiDimId)
        )

        if (opts.multiDimIds.length !== multiDimsToArchive.length) {
            throw new Error(
                `Not all multi-dim IDs were found in the database. Found ${multiDimsToArchive.length} out of ${opts.multiDimIds.length}.`
            )
        }

        return multiDimsToArchive
    }

    return await findChangedMultiDimPages(trx)
}

/**
 * Fetches configurations for graphers that need to be archived
 */
const getGrapherConfigs = async (
    trx: db.KnexReadWriteTransaction,
    graphersToArchive: GrapherChecksumsObjectWithHash[]
): Promise<MinimalChartInfo[]> => {
    if (graphersToArchive.length === 0) {
        return []
    }

    const grapherIds = graphersToArchive.map((grapher) => grapher.chartId)
    const rawGrapherConfigs = await getEnrichedChartsByIds(trx, grapherIds)

    return rawGrapherConfigs.map((config) => ({
        chartId: config.id,
        chartConfigId: config.configId,
        config: config.config,
    }))
}

/**
 * Collects all variable IDs from both grapher and multi-dimensional configurations
 */
const collectAllVariableIds = (
    grapherConfigs: MinimalChartInfo[],
    multiDimConfigs: MinimalMultiDimInfo[],
    explorersToArchive: ExplorerChecksumsObjectWithHash[]
): Set<number> => {
    const allVariableIds = new Set<number>()

    // Collect variable IDs from grapher configs
    const grapherVariableIds = grapherConfigs.flatMap(
        (config) =>
            config.config.dimensions?.map(
                (d: OwidChartDimensionInterface) => d.variableId
            ) ?? []
    )
    grapherVariableIds.forEach((id) => id && allVariableIds.add(id))

    // Collect variable IDs from multi-dimensional configs
    const multiDimVariableIds = multiDimConfigs.flatMap((config) => [
        ...getAllVariableIds(config.config.views),
    ])
    multiDimVariableIds.forEach((id) => allVariableIds.add(id))

    // Collect variable IDs from explorers via checksums
    for (const explorer of explorersToArchive) {
        const ids = Object.keys(explorer.checksums.indicators).map((k) =>
            parseInt(k, 10)
        )
        ids.forEach((id) => allVariableIds.add(id))
    }

    return allVariableIds
}

/**
 * Collects all chart config UUIDs from multi-dimensional configurations
 */
const collectAllChartConfigIds = (
    multiDimConfigs: MinimalMultiDimInfo[]
): Set<string> => {
    const allChartConfigIds = new Set<string>()
    for (const config of multiDimConfigs) {
        for (const view of config.config.views) {
            if (view.fullConfigId) {
                allChartConfigIds.add(view.fullConfigId)
            }
        }
    }
    return allChartConfigIds
}

/**
 * Outputs what would be archived in dry run mode
 */
const outputDryRunResults = (archivalData: ArchivalData): void => {
    const { graphersToArchive, multiDimsToArchive, explorersToArchive } =
        archivalData
    const totalToArchive =
        graphersToArchive.length +
        multiDimsToArchive.length +
        explorersToArchive.length

    console.log("Would archive", totalToArchive, "pages:")

    if (graphersToArchive.length > 0) {
        console.log(
            "Grapher IDs:",
            graphersToArchive.map((grapher) => grapher.chartId)
        )
    }

    if (multiDimsToArchive.length > 0) {
        console.log(
            "Multi-dim IDs:",
            multiDimsToArchive.map((multiDim) => multiDim.multiDimId)
        )
    }

    if (explorersToArchive.length > 0) {
        console.log(
            "Explorer slugs:",
            explorersToArchive.map((exp) => exp.explorerSlug)
        )
    }
}

/**
 * Archives grapher pages and generates related files
 */
const archiveGrapherPages = async (
    trx: db.KnexReadWriteTransaction,
    graphersToArchive: GrapherChecksumsObjectWithHash[],
    grapherConfigs: MinimalChartInfo[],
    commonCtx: CommonArchivalContext,
    variableFiles: Record<number, AssetMap>,
    archivalDate: ArchivalTimestamp,
    opts: Options
): Promise<void> => {
    if (graphersToArchive.length === 0) return

    const { manifests } = await bakeArchivalGrapherPagesToFolder(
        trx,
        graphersToArchive,
        grapherConfigs,
        commonCtx,
        variableFiles
    )

    await insertChartVersions(trx, graphersToArchive, archivalDate, manifests)

    await generateChartVersionsFiles(
        trx,
        opts.dir,
        graphersToArchive.map((grapher) => grapher.chartId)
    )
}

/**
 * Archives multi-dimensional pages and generates related files
 */
const archiveMultiDimPages = async (
    trx: db.KnexReadWriteTransaction,
    multiDimsToArchive: MultiDimChecksumsObjectWithHash[],
    multiDimConfigs: MinimalMultiDimInfo[],
    commonCtx: CommonArchivalContext,
    variableFiles: Record<number, AssetMap>,
    chartConfigFiles: Record<string, AssetMap>,
    archivalDate: ArchivalTimestamp,
    opts: Options
): Promise<void> => {
    if (multiDimsToArchive.length === 0) return

    const { manifests } = await bakeArchivalMultiDimPagesToFolder(
        trx,
        multiDimsToArchive,
        multiDimConfigs,
        commonCtx,
        variableFiles,
        chartConfigFiles
    )

    await insertMultiDimVersions(
        trx,
        multiDimsToArchive,
        archivalDate,
        manifests
    )

    await generateMultiDimVersionsFiles(
        trx,
        opts.dir,
        multiDimsToArchive.map((multiDim) => multiDim.multiDimId)
    )
}

/**
 * Archives explorer pages and generates related files
 */
const archiveExplorerPages = async (
    trx: db.KnexReadWriteTransaction,
    explorersToArchive: ExplorerChecksumsObjectWithHash[],
    explorerPrograms: ExplorerProgram[],
    commonCtx: CommonArchivalContext,
    variableFiles: Record<number, AssetMap>,
    archivalDate: ArchivalTimestamp,
    opts: Options
): Promise<void> => {
    if (explorersToArchive.length === 0) return

    const { manifests } = await bakeArchivalExplorerPagesToFolder(
        trx,
        explorersToArchive,
        explorerPrograms,
        commonCtx,
        variableFiles
    )

    await insertExplorerVersions(
        trx,
        explorersToArchive,
        archivalDate,
        manifests
    )

    await generateExplorerVersionsFiles(
        trx,
        opts.dir,
        explorersToArchive.map((exp) => exp.explorerSlug)
    )
}

/**
 * Main function that orchestrates the archival process
 */
const findChangedPagesAndArchive = async (opts: Options): Promise<void> => {
    await db.knexReadWriteTransaction(async (trx) => {
        // Determine what needs to be archived
        const [graphersToArchive, multiDimsToArchive, explorersToArchive] =
            await Promise.all([
                getGraphersToArchive(trx, opts),
                getMultiDimsToArchive(trx, opts),
                getExplorersToArchive(trx, opts),
            ])

        const totalToArchive =
            graphersToArchive.length +
            multiDimsToArchive.length +
            explorersToArchive.length

        // Handle dry run mode
        if (opts.dryRun) {
            outputDryRunResults({
                graphersToArchive,
                multiDimsToArchive,
                explorersToArchive,
                grapherConfigs: [],
                multiDimConfigs: [],
                explorerPrograms: [],
            })
            return
        }

        // Exit early if nothing to archive
        if (totalToArchive === 0) {
            console.log("No pages need to be archived, exiting.")
            return
        }

        // Fetch configurations for pages to be archived
        const archivalDate = getDateForArchival()
        const [grapherConfigs, multiDimConfigs, explorerPrograms, commonCtx] =
            await Promise.all([
                getGrapherConfigs(trx, graphersToArchive),
                getMultiDimConfigs(trx, multiDimsToArchive),
                getExplorerPrograms(trx, explorersToArchive),
                createCommonArchivalContext(trx, opts.dir, archivalDate),
            ])

        // Collect all variable IDs and create variable files
        const allVariableIds = collectAllVariableIds(
            grapherConfigs,
            multiDimConfigs,
            explorersToArchive
        )
        const variableFiles = await archiveVariableIds(
            [...allVariableIds],
            commonCtx.baseArchiveDir
        )

        // Collect all chart config UUIDs and create chart config files
        const allChartConfigIds = collectAllChartConfigIds(multiDimConfigs)
        const chartConfigFiles = await archiveChartConfigs(
            trx,
            [...allChartConfigIds],
            commonCtx.baseArchiveDir
        )

        // Archive both types of pages
        await Promise.all([
            archiveGrapherPages(
                trx,
                graphersToArchive,
                grapherConfigs,
                commonCtx,
                variableFiles,
                archivalDate,
                opts
            ),
            archiveMultiDimPages(
                trx,
                multiDimsToArchive,
                multiDimConfigs,
                commonCtx,
                variableFiles,
                chartConfigFiles,
                archivalDate,
                opts
            ),
            archiveExplorerPages(
                trx,
                explorersToArchive,
                explorerPrograms,
                commonCtx,
                variableFiles,
                archivalDate,
                opts
            ),
        ])

        if (opts.latestDir) {
            await copyToLatestDir(
                commonCtx.baseArchiveDir,
                commonCtx.archiveDir
            )
        }
    })

    process.exit(0)
}

void yargs(hideBin(process.argv))
    .command<Options>(
        "$0 [dir]",
        "Archive changed pages to a local folder",
        (yargs) => {
            yargs
                .positional("dir", {
                    type: "string",
                    default: "archive",
                    describe: "Directory to save the archived pages",
                })
                .option("latestDir", {
                    type: "boolean",
                    description:
                        "Copy the archived pages to a 'latest' directory, for ease of testing",
                })
                .option("dryRun", {
                    type: "boolean",
                    description: "Don't actually archive the pages",
                })
                .option("chartIds", {
                    type: "array",
                    description:
                        "Only archive these chart IDs, regardless of whether they've changed",
                    coerce: (arg) => {
                        const splitAndParse = (s: string | number) =>
                            typeof s === "string"
                                ? s.split(/\s+|,/).map((x) => parseInt(x, 10))
                                : [s]

                        return Array.isArray(arg)
                            ? arg.flatMap(splitAndParse)
                            : splitAndParse(arg)
                    },
                })
                .option("multiDimIds", {
                    type: "array",
                    description:
                        "Only archive these multi-dim IDs, regardless of whether they've changed",
                    coerce: (arg) => {
                        const splitAndParse = (s: string | number) =>
                            typeof s === "string"
                                ? s.split(/\s+|,/).map((x) => parseInt(x, 10))
                                : [s]

                        return Array.isArray(arg)
                            ? arg.flatMap(splitAndParse)
                            : splitAndParse(arg)
                    },
                })
                .option("explorerSlugs", {
                    type: "array",
                    description:
                        "Only archive these explorer slugs, regardless of whether they've changed",
                    coerce: (arg) => {
                        const split = (s: string | number) =>
                            typeof s === "string"
                                ? s.split(/\s+|,/)
                                : [String(s)]
                        return Array.isArray(arg)
                            ? arg.flatMap(split)
                            : split(arg)
                    },
                })
                .option("type", {
                    type: "string",
                    choices: ["charts", "multiDims", "explorers", "all"],
                    default: "all",
                    description: "What type of pages to archive",
                })
        },
        async (opts) => {
            await findChangedPagesAndArchive(opts).catch(async (e) => {
                console.error("Error in findChangedPagesAndArchive:", e)
                Sentry.captureException(e)
                await Sentry.close()
                process.exit(1)
            })

            process.exit(0)
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
