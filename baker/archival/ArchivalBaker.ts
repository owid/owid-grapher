import * as _ from "lodash-es"
import {
    ArchiveMetaInformation,
    ArchiveSiteNavigationInfo,
    ArchiveVersions,
    AssetMap,
    ChartConfigsTableName,
    DbEnrichedImage,
    DbPlainArchivedChartVersion,
    DbPlainArchivedMultiDimVersion,
    DbRawChartConfig,
    GrapherInterface,
    MultiDimDataPageConfigEnriched,
    UrlAndMaybeDate,
    GrapherChecksumsObjectWithHash,
    MultiDimChecksumsObjectWithHash,
    ExplorerChecksumsObjectWithHash,
} from "@ourworldindata/types"
import fs from "fs-extra"
import path from "path"
import * as db from "../../db/db.js"
import { getAllImages } from "../../db/model/Image.js"
import { getVariableData } from "../../db/model/Variable.js"
import findProjectBaseDir from "../../settings/findBaseDir.js"
import { bakeSingleGrapherPageForArchival } from "../GrapherBaker.js"
import { bakeSingleMultiDimDataPageForArchival } from "../MultiDimBaker.js"
import { bakeSingleExplorerPageForArchival } from "../ExplorerBaker.js"
import {
    hashAndCopyFile,
    hashAndWriteFile,
} from "../../serverUtils/archivalFileUtils.js"
import {
    GrapherArchivalManifest,
    MultiDimArchivalManifest,
    ExplorerArchivalManifest,
    assembleGrapherArchivalUrl,
    assembleGrapherManifest,
    assembleExplorerArchivalUrl,
    assembleMultiDimArchivalUrl,
    assembleMultiDimManifest,
    assembleExplorerManifest,
} from "../../serverUtils/archivalUtils.js"
import pMap from "p-map"
import {
    getAllChartVersionsForChartId,
    getAllMultiDimVersionsForId,
    getAllExplorerVersionsForSlug,
    getLatestGrapherArchivedVersionsFromDb,
    getLatestMultiDimArchivedVersionsFromDb,
    getLatestExplorerArchivedVersionsFromDb,
} from "../../db/model/archival/archivalDb.js"
import { ARCHIVE_BASE_URL } from "../../settings/serverSettings.js"
import {
    ArchivalTimestamp,
    convertToArchivalDateStringIfNecessary,
    getAllVariableIds,
} from "@ourworldindata/utils"
import { PROD_URL } from "../../site/SiteConstants.js"
import { getParsedDodsDictionary } from "../../db/model/Dod.js"
import { ExplorerProgram } from "@ourworldindata/explorer"

export const projBaseDir = findProjectBaseDir(__dirname)
if (!projBaseDir) throw new Error("Could not find project base directory")

const IGNORED_FILES_PATTERNS = [
    /^_headers$/,
    /\.DS_Store$/,
    /^images(\/.*)?$/,
    /^sdg.*$/,
    /^identifyadmin.html$/,
]
export const copyPublicDir = async (archiveDir: string) => {
    const publicDir = path.join(projBaseDir, "public")
    const archivalPublicDir = path.join(__dirname, "public")
    const targetDir = archiveDir
    const ignoredFilesPattern = new RegExp(
        IGNORED_FILES_PATTERNS.map((p) => p.source).join("|")
    )

    for (const srcDir of [publicDir, archivalPublicDir]) {
        await fs.copy(srcDir, targetDir, {
            overwrite: true,
            filter: (src) => {
                const relativePath = path.relative(srcDir, src)
                if (ignoredFilesPattern.test(relativePath)) {
                    console.log(`Ignoring ${relativePath}`)
                    return false
                }
                return true
            },
        })
    }
}

export const bakeDods = async (
    knex: db.KnexReadonlyTransaction,
    archiveDir: string
) => {
    const parsedDods = await getParsedDodsDictionary(knex)

    const targetPath = path.join(archiveDir, "assets", "dods.json")
    const resultFilename = await hashAndWriteFile(
        targetPath,
        JSON.stringify(parsedDods)
    ).then((fullPath) => path.basename(fullPath))

    return { "dods.json": `/assets/${resultFilename}` }
}

const bakeVariableDataFiles = async (
    variableId: number,
    archiveDir: string
) => {
    const { data, metadata } = await getVariableData(variableId, {
        noCache: true,
    })
    const dataStringified = JSON.stringify(data)
    const metadataStringified = JSON.stringify(metadata)

    const apiPath = "api/v1/indicators"
    const dataFilename = path.join(
        archiveDir,
        `${apiPath}/${variableId}.data.json`
    )
    const metadataFilename = path.join(
        archiveDir,
        `${apiPath}/${variableId}.metadata.json`
    )

    const [dataFilenameWithHash, metadataFilenameWithHash] = await Promise.all([
        hashAndWriteFile(dataFilename, dataStringified).then((fn) =>
            path.basename(fn)
        ),
        hashAndWriteFile(metadataFilename, metadataStringified).then((fn) =>
            path.basename(fn)
        ),
    ])

    return {
        [path.basename(dataFilename)]: `/${apiPath}/${dataFilenameWithHash}`,
        [path.basename(metadataFilename)]:
            `/${apiPath}/${metadataFilenameWithHash}`,
    }
}

const bakeOwidMjsFile = async (
    srcPath: string,
    destPath: string,
    sourceMapFilename: string
) => {
    const mjsContents = await fs.readFile(srcPath, "utf8")
    const withSourceMap = mjsContents.replace(
        /\/\/# sourceMappingURL=owid.mjs.map/g,
        `//# sourceMappingURL=${sourceMapFilename}`
    )

    if (withSourceMap === mjsContents) {
        console.error("Failed to replace sourceMappingURL in owid.mjs")
    }
    return await hashAndWriteFile(destPath, withSourceMap)
}

// we explicitly want owid.mjs.map to come first, so that we can replace the sourceMappingURL in owid.mjs
// after we know the content-hashed filename of owid.map.mjs
const ASSET_FILES = ["owid.mjs.map", "owid.mjs", "owid.css"]
const IGNORED_FILES = [".vite"]
export const bakeAssets = async (archiveDir: string) => {
    const srcDir = path.join(projBaseDir, "dist/assets-archive")
    const targetDir = path.join(archiveDir, "assets")

    await fs.mkdirp(targetDir)

    const staticAssetMap: AssetMap = {}

    const filesInDir = await fs.readdir(srcDir, { withFileTypes: true })

    for await (const filename of ASSET_FILES) {
        if (!filesInDir.some((dirent) => dirent.name === filename)) {
            throw new Error(`Could not find ${filename} in ${srcDir}`)
        }
        const srcFile = path.join(srcDir, filename)

        let outFilename: string
        if (filename === "owid.mjs") {
            const sourceMapFilename = path.basename(
                staticAssetMap["owid.mjs.map"] ?? ""
            )
            if (!sourceMapFilename)
                throw new Error("Could not find owid.mjs.map in staticAssetMap")

            outFilename = await bakeOwidMjsFile(
                srcFile,
                path.join(targetDir, filename),
                sourceMapFilename
            )
        } else {
            outFilename = await hashAndCopyFile(srcFile, targetDir)
        }
        const outFilenameRelative = path.relative(archiveDir, outFilename)
        staticAssetMap[filename] = `/${outFilenameRelative}`
    }

    const additionalFiles = new Set(
        filesInDir.map((dirent) => dirent.name)
    ).difference(new Set([...ASSET_FILES, ...IGNORED_FILES]))
    if (additionalFiles.size > 0) {
        console.warn(
            `Found additional files in ${srcDir}:`,
            Array.from(additionalFiles).join(", ")
        )
    }

    return { staticAssetMap }
}

export const archiveVariableIds = async (
    variableIds: number[],
    archiveDir: string
) => {
    const results = await pMap(
        variableIds,
        async (variableId) => {
            return {
                [variableId]: await bakeVariableDataFiles(
                    variableId,
                    archiveDir
                ),
            }
        },
        { concurrency: 40 }
    )
    // merge all the results into a single object
    return results.reduce((acc, result) => ({ ...acc, ...result }), {})
}

const bakeChartConfig = async (
    knex: db.KnexReadonlyTransaction,
    chartConfigId: string,
    archiveDir: string
) => {
    // Fetch the grapher config from the database
    const chartConfigRow = await knex<DbRawChartConfig>(ChartConfigsTableName)
        .select("full")
        .where("id", chartConfigId)
        .first()

    if (!chartConfigRow) {
        throw new Error(`Chart config not found with id: ${chartConfigId}`)
    }

    const configStringified = chartConfigRow.full

    const apiPath = "grapher/by-uuid"
    const configFilename = path.join(
        archiveDir,
        `${apiPath}/${chartConfigId}.config.json`
    )

    const configFilenameWithHash = await hashAndWriteFile(
        configFilename,
        configStringified
    ).then((fn) => path.basename(fn))

    return {
        [`${chartConfigId}.config.json`]: `/${apiPath}/${configFilenameWithHash}`,
    }
}

export const archiveChartConfigs = async (
    knex: db.KnexReadonlyTransaction,
    chartConfigIds: string[],
    archiveDir: string
) => {
    const results = await pMap(
        chartConfigIds,
        async (chartConfigId) => {
            return {
                [chartConfigId]: await bakeChartConfig(
                    knex,
                    chartConfigId,
                    archiveDir
                ),
            }
        },
        { concurrency: 40 }
    )
    // merge all the results into a single object
    return results.reduce((acc, result) => ({ ...acc, ...result }), {})
}

export interface MinimalChartInfo {
    chartId: number
    chartConfigId: string
    config: GrapherInterface
}

export interface MinimalMultiDimInfo {
    id: number
    slug: string
    config: MultiDimDataPageConfigEnriched
}

export const createCommonArchivalContext = async (
    knex: db.KnexReadonlyTransaction,
    baseDir: string,
    date: ArchivalTimestamp
): Promise<CommonArchivalContext> => {
    const archiveDir = path.resolve(projBaseDir, baseDir)
    const dir = path.join(archiveDir, date.formattedDate)

    await fs.mkdirp(dir)
    await copyPublicDir(archiveDir)

    const { staticAssetMap } = await bakeAssets(archiveDir)
    const commonRuntimeFiles = await bakeDods(knex, archiveDir)
    const imageMetadataDictionary = await getAllImages(knex).then((images) =>
        _.keyBy(images, "filename")
    )

    return {
        date,
        baseArchiveDir: archiveDir,
        archiveDir: dir,
        commonRuntimeFiles,
        staticAssetMap,
        imageMetadataDictionary,
    }
}

export const bakeArchivalGrapherPagesToFolder = async (
    knex: db.KnexReadonlyTransaction,
    grapherChecksumsObjsToBeArchived: GrapherChecksumsObjectWithHash[],
    grapherConfigs: MinimalChartInfo[],
    commonCtx: CommonArchivalContext,
    variableFiles: Record<number, AssetMap>
) => {
    const grapherIds = grapherChecksumsObjsToBeArchived.map((c) => c.chartId)
    const latestArchivalVersions = await getLatestGrapherArchivedVersionsFromDb(
        knex,
        grapherIds
    ).then((rows) => _.keyBy(rows, (v) => v.grapherId))

    await fs.mkdirp(path.join(commonCtx.archiveDir, "grapher"))
    console.log(`Baking grapher pages locally to dir '${commonCtx.archiveDir}'`)

    const manifests: Record<number, GrapherArchivalManifest> = {}

    let i = 0
    for (const grapherInfo of grapherConfigs) {
        i++

        const checksumsObj = grapherChecksumsObjsToBeArchived.find(
            (c) => c.chartId === grapherInfo.chartId
        )
        if (!checksumsObj)
            throw new Error(
                `Could not find checksums for chartId ${grapherInfo.chartId}, this shouldn't happen`
            )

        await bakeGrapherPageForArchival(
            knex,
            commonCtx.archiveDir,
            grapherInfo,
            {
                ...commonCtx,
                variableFiles,
                checksumsObj,
                latestArchivalVersions,
            }
        ).then((manifest) => {
            manifests[grapherInfo.chartId] = manifest
        })

        console.log(`${i}/${grapherConfigs.length} ${grapherInfo.config.slug}`)
    }
    console.log(`Baked ${grapherConfigs.length} grapher pages`)

    return { manifests }
}

export const bakeArchivalMultiDimPagesToFolder = async (
    knex: db.KnexReadonlyTransaction,
    multiDimChecksumsObjsToBeArchived: MultiDimChecksumsObjectWithHash[],
    multiDimConfigs: MinimalMultiDimInfo[],
    commonCtx: CommonArchivalContext,
    variableFiles: Record<number, AssetMap>,
    chartConfigFiles: Record<string, AssetMap>
) => {
    await fs.mkdirp(path.join(commonCtx.archiveDir, "grapher"))
    console.log(
        `Baking multi-dim pages locally to dir '${commonCtx.archiveDir}'`
    )

    const manifests: Record<number, MultiDimArchivalManifest> = {}

    const multiDimIds = multiDimChecksumsObjsToBeArchived.map(
        (c) => c.multiDimId
    )
    const latestArchivalVersions =
        await getLatestMultiDimArchivedVersionsFromDb(knex, multiDimIds).then(
            (rows) => _.keyBy(rows, (v) => v.multiDimId)
        )

    let i = 0
    for (const multiDimInfo of multiDimConfigs) {
        i++

        const checksumsObj = multiDimChecksumsObjsToBeArchived.find(
            (c) => c.multiDimId === multiDimInfo.id
        )
        if (!checksumsObj)
            throw new Error(
                `Could not find checksums for multiDimId ${multiDimInfo.id}, this shouldn't happen`
            )

        await bakeMultiDimDataPageForArchival(
            knex,
            commonCtx.archiveDir,
            multiDimInfo,
            {
                ...commonCtx,
                variableFiles,
                chartConfigFiles,
                checksumsObj,
                latestArchivalVersions,
            }
        ).then((manifest) => {
            manifests[multiDimInfo.id] = manifest
        })

        console.log(`${i}/${multiDimConfigs.length} ${multiDimInfo.slug}`)
    }
    console.log(`Baked ${multiDimConfigs.length} multi-dim pages`)

    return { manifests }
}

export const bakeArchivalExplorerPagesToFolder = async (
    knex: db.KnexReadonlyTransaction,
    explorerChecksumsObjsToBeArchived: ExplorerChecksumsObjectWithHash[],
    explorerPrograms: ExplorerProgram[],
    commonCtx: CommonArchivalContext,
    variableFiles: Record<number, AssetMap>
) => {
    await fs.mkdirp(path.join(commonCtx.archiveDir, "explorers"))
    console.log(
        `Baking explorer pages locally to dir '${commonCtx.archiveDir}'`
    )

    const manifests: Record<string, ExplorerArchivalManifest> = {}

    const slugs = explorerChecksumsObjsToBeArchived.map((c) => c.explorerSlug)
    const latestArchivalVersions =
        await getLatestExplorerArchivedVersionsFromDb(knex, slugs).then(
            (rows) => _.keyBy(rows, (v) => v.explorerSlug)
        )

    let i = 0
    for (const program of explorerPrograms) {
        i++

        const checksumsObj = explorerChecksumsObjsToBeArchived.find(
            (c) => c.explorerSlug === program.slug
        )
        if (!checksumsObj)
            throw new Error(
                `Could not find checksums for explorer '${program.slug}', this shouldn't happen`
            )

        const runtimeFiles: AssetMap = { ...commonCtx.commonRuntimeFiles }
        const indicatorIds = Object.keys(checksumsObj.checksums.indicators).map(
            (k) => parseInt(k, 10)
        )
        for (const variableId of indicatorIds) {
            if (!variableFiles[variableId])
                throw new Error(
                    `Could not find variable info for variableId ${variableId}`
                )
            Object.assign(runtimeFiles, variableFiles[variableId])
        }

        const manifest = await assembleExplorerManifest({
            staticAssetMap: commonCtx.staticAssetMap,
            runtimeAssetMap: runtimeFiles,
            checksumsObj,
            archivalDate: commonCtx.date.formattedDate,
        })

        // Create archive navigation for explorer
        const previousVersionInfo =
            latestArchivalVersions[program.slug] ?? undefined
        const previousVersion: UrlAndMaybeDate | undefined = previousVersionInfo
            ? {
                  date: previousVersionInfo.archivalTimestamp,
                  url: assembleExplorerArchivalUrl(
                      previousVersionInfo.archivalTimestamp,
                      previousVersionInfo.explorerSlug,
                      { relative: true }
                  ),
              }
            : undefined

        const archiveNavigation: ArchiveSiteNavigationInfo = {
            liveUrl: `${PROD_URL}/explorers/${program.slug}`,
            previousVersion,
            versionsFileUrl: `/versions/explorers/${program.slug}.json`,
        }

        const fullUrl = assembleExplorerArchivalUrl(
            commonCtx.date.formattedDate,
            program.slug,
            { relative: false }
        )

        const archiveInfo: ArchiveMetaInformation = {
            archivalDate: commonCtx.date.formattedDate,
            archiveNavigation,
            archiveUrl: fullUrl,
            assets: {
                runtime: runtimeFiles,
                static: commonCtx.staticAssetMap,
            },
            type: "archive-page",
        }

        await bakeSingleExplorerPageForArchival(
            commonCtx.archiveDir,
            program,
            knex,
            { manifest, archiveInfo }
        )

        manifests[program.slug] = manifest

        console.log(`${i}/${explorerPrograms.length} ${program.slug}`)
    }
    console.log(`Baked ${explorerPrograms.length} explorer pages`)

    return { manifests }
}

export interface CommonArchivalContext {
    date: ArchivalTimestamp
    baseArchiveDir: string
    archiveDir: string
    commonRuntimeFiles: AssetMap
    staticAssetMap: Record<string, string>
    imageMetadataDictionary: Record<string, DbEnrichedImage>
}

interface GrapherBakeContext extends CommonArchivalContext {
    variableFiles: Record<number, AssetMap>
    checksumsObj: GrapherChecksumsObjectWithHash
    latestArchivalVersions: Record<
        number,
        Pick<
            DbPlainArchivedChartVersion,
            "grapherId" | "grapherSlug" | "archivalTimestamp"
        >
    >
}

interface MultiDimBakeContext extends CommonArchivalContext {
    variableFiles: Record<number, AssetMap>
    chartConfigFiles: Record<string, AssetMap>
    checksumsObj: MultiDimChecksumsObjectWithHash
    latestArchivalVersions: Record<
        number,
        Pick<
            DbPlainArchivedMultiDimVersion,
            "multiDimId" | "multiDimSlug" | "archivalTimestamp"
        >
    >
}

async function bakeGrapherPageForArchival(
    trx: db.KnexReadonlyTransaction,
    dir: string,
    chartInfo: MinimalChartInfo,
    ctx: GrapherBakeContext
) {
    const { chartConfigId, config } = chartInfo
    const {
        commonRuntimeFiles,
        imageMetadataDictionary,
        staticAssetMap,
        variableFiles,
        checksumsObj,
        date,
        latestArchivalVersions,
    } = ctx

    if (!config.slug) throw new Error("Grapher slug is missing")
    if (!ARCHIVE_BASE_URL) throw new Error("ARCHIVE_BASE_URL is missing")

    const runtimeFiles = { ...commonRuntimeFiles }

    for (const dim of config.dimensions ?? []) {
        if (dim.variableId) {
            const variableId = dim.variableId
            if (!variableFiles[variableId])
                throw new Error(
                    `Could not find variable info for variableId ${variableId}`
                )
            Object.assign(runtimeFiles, variableFiles[variableId])
        }
    }

    const manifest = await assembleGrapherManifest({
        staticAssetMap,
        runtimeAssetMap: runtimeFiles,
        checksumsObj,
        archivalDate: date.formattedDate,
        chartConfigId,
    })
    const previousVersionInfo =
        latestArchivalVersions[chartInfo.chartId] ?? undefined
    const previousVersion: UrlAndMaybeDate | undefined = previousVersionInfo
        ? {
              date: previousVersionInfo.archivalTimestamp,
              url: assembleGrapherArchivalUrl(
                  previousVersionInfo.archivalTimestamp,
                  previousVersionInfo.grapherSlug,
                  { relative: true }
              ),
          }
        : undefined
    const archiveNavigation: ArchiveSiteNavigationInfo = {
        liveUrl: `${PROD_URL}/grapher/${config.slug}`,
        previousVersion,
        versionsFileUrl: `/versions/charts/${chartInfo.chartId}.json`,
    }
    const fullUrl = assembleGrapherArchivalUrl(
        date.formattedDate,
        config.slug,
        { relative: false }
    )
    const archiveInfo: ArchiveMetaInformation = {
        archivalDate: date.formattedDate,
        archiveNavigation,
        archiveUrl: fullUrl,
        assets: {
            runtime: runtimeFiles,
            static: staticAssetMap,
        },
        type: "archive-page",
    }
    await bakeSingleGrapherPageForArchival(dir, config, trx, {
        imageMetadataDictionary,
        manifest,
        archiveInfo,
    })
    return manifest
}

export async function copyToLatestDir(archiveDir: string, dir: string) {
    // we want to copy the baked site to an overwrite-only `latest` directory,
    // where we never delete files, only add new ones or overwrite existing ones

    const latestDir = path.join(archiveDir, "latest")
    await fs.mkdirp(latestDir)

    let filesCopied = 0,
        dirsCopied = 0
    for await (const file of await fs.opendir(dir, { recursive: true })) {
        console.log(`Copying ${file.name}`)
        const relativePath = path.relative(dir, file.parentPath)

        if (file.isDirectory()) {
            dirsCopied++
            await fs.mkdirp(path.join(latestDir, relativePath))
        } else if (file.isFile()) {
            filesCopied++
            await fs.copy(
                path.join(file.parentPath, file.name),
                path.join(latestDir, relativePath, file.name),
                { overwrite: true }
            )
        }
    }

    console.log(
        `Copied ${dir} to ${latestDir} (${filesCopied} files, ${dirsCopied} dirs)`
    )
}

export async function generateChartVersionsFiles(
    knex: db.KnexReadWriteTransaction,
    dir: string,
    chartIds: number[]
) {
    console.log(`Generating chart versions files for ${chartIds.length} charts`)
    const targetPath = path.join(dir, "versions", "charts")
    await fs.mkdirp(targetPath)

    await pMap(
        chartIds,
        async (chartId) => {
            const chartVersions = await getAllChartVersionsForChartId(
                knex,
                chartId
            ).then((rows) =>
                rows.map((r) => ({
                    archivalDate: convertToArchivalDateStringIfNecessary(
                        r.archivalTimestamp
                    ),
                    url: assembleGrapherArchivalUrl(
                        r.archivalTimestamp,
                        r.grapherSlug,
                        { relative: true }
                    ),
                    slug: r.grapherSlug,
                }))
            )

            const fileContent = {
                chartId: chartId,
                versions: chartVersions,
            } satisfies ArchiveVersions
            await fs.writeFile(
                path.join(targetPath, `${chartId}.json`),
                JSON.stringify(fileContent, undefined, 2),
                {
                    encoding: "utf8",
                }
            )
        },
        { concurrency: 10 }
    )
    console.log(
        `Finished generating chart versions files for ${chartIds.length} charts`
    )
}

export const bakeMultiDimDataPageForArchival = async (
    trx: db.KnexReadonlyTransaction,
    dir: string,
    multiDimInfo: MinimalMultiDimInfo,
    ctx: MultiDimBakeContext
) => {
    const { config, slug, id } = multiDimInfo
    const {
        commonRuntimeFiles,
        imageMetadataDictionary,
        staticAssetMap,
        variableFiles,
        chartConfigFiles,
        checksumsObj,
        date,
        latestArchivalVersions = {},
    } = ctx

    if (!slug) throw new Error("Multi-dim page slug is missing")
    if (!ARCHIVE_BASE_URL) throw new Error("ARCHIVE_BASE_URL is missing")

    const runtimeFiles = { ...commonRuntimeFiles }

    // Add variable files for all variables used in this multi-dim page
    for (const variableId of getAllVariableIds(config.views)) {
        if (!variableFiles[variableId])
            throw new Error(
                `Could not find variable info for variableId ${variableId}`
            )
        Object.assign(runtimeFiles, variableFiles[variableId])
    }

    // Add chart config files for all grapher configs used in this multi-dim page
    for (const view of config.views) {
        if (view.fullConfigId) {
            if (!chartConfigFiles[view.fullConfigId])
                throw new Error(
                    `Could not find chart config info for configId ${view.fullConfigId}`
                )
            Object.assign(runtimeFiles, chartConfigFiles[view.fullConfigId])
        }
    }

    // Create manifest for multi-dim page
    const manifest = await assembleMultiDimManifest({
        staticAssetMap,
        runtimeAssetMap: runtimeFiles,
        checksumsObj,
        archivalDate: date.formattedDate,
    })

    // Create archive navigation (similar to grapher but for multi-dim pages)
    const previousVersionInfo = latestArchivalVersions[id] ?? undefined
    const previousVersion: UrlAndMaybeDate | undefined = previousVersionInfo
        ? {
              date: previousVersionInfo.archivalTimestamp,
              url: assembleMultiDimArchivalUrl(
                  previousVersionInfo.archivalTimestamp,
                  previousVersionInfo.multiDimSlug,
                  { relative: true }
              ),
          }
        : undefined

    const archiveNavigation: ArchiveSiteNavigationInfo = {
        liveUrl: `${PROD_URL}/grapher/${slug}`,
        previousVersion,
        versionsFileUrl: `/versions/multi-dim/${id}.json`,
    }

    const fullUrl = assembleMultiDimArchivalUrl(date.formattedDate, slug, {
        relative: false,
    })

    const archiveInfo: ArchiveMetaInformation = {
        archivalDate: date.formattedDate,
        archiveNavigation,
        archiveUrl: fullUrl,
        assets: {
            runtime: runtimeFiles,
            static: staticAssetMap,
        },
        type: "archive-page",
    }

    await bakeSingleMultiDimDataPageForArchival(dir, slug, config, trx, {
        imageMetadataDictionary,
        manifest,
        archiveInfo,
    })

    return manifest
}

export async function generateMultiDimVersionsFiles(
    knex: db.KnexReadWriteTransaction,
    dir: string,
    multiDimIds: number[]
) {
    console.log(
        `Generating multi-dim versions files for ${multiDimIds.length} multi-dim pages`
    )
    const targetPath = path.join(dir, "versions", "multi-dim")
    await fs.mkdirp(targetPath)

    await pMap(
        multiDimIds,
        async (multiDimId) => {
            const multiDimVersions = await getAllMultiDimVersionsForId(
                knex,
                multiDimId
            ).then((rows) =>
                rows.map((r) => ({
                    archivalDate: convertToArchivalDateStringIfNecessary(
                        r.archivalTimestamp
                    ),
                    url: assembleMultiDimArchivalUrl(
                        r.archivalTimestamp,
                        r.multiDimSlug,
                        { relative: true }
                    ),
                    slug: r.multiDimSlug,
                }))
            )

            const fileContent = {
                multiDimId: multiDimId,
                versions: multiDimVersions,
            }
            await fs.writeFile(
                path.join(targetPath, `${multiDimId}.json`),
                JSON.stringify(fileContent, undefined, 2),
                {
                    encoding: "utf8",
                }
            )
        },
        { concurrency: 10 }
    )
    console.log(
        `Finished generating multi-dim versions files for ${multiDimIds.length} multi-dim pages`
    )
}

export async function generateExplorerVersionsFiles(
    knex: db.KnexReadWriteTransaction,
    dir: string,
    explorerSlugs: string[]
) {
    console.log(
        `Generating explorer versions files for ${explorerSlugs.length} explorers`
    )
    const targetPath = path.join(dir, "versions", "explorers")
    await fs.mkdirp(targetPath)

    await pMap(
        explorerSlugs,
        async (slug) => {
            const explorerVersions = await getAllExplorerVersionsForSlug(
                knex,
                slug
            ).then((rows) =>
                rows.map((r) => ({
                    archivalDate: convertToArchivalDateStringIfNecessary(
                        r.archivalTimestamp
                    ),
                    url: assembleExplorerArchivalUrl(
                        r.archivalTimestamp,
                        r.explorerSlug,
                        { relative: true }
                    ),
                    slug: r.explorerSlug,
                }))
            )

            const fileContent = {
                explorerSlug: slug,
                versions: explorerVersions,
            }
            await fs.writeFile(
                path.join(targetPath, `${slug}.json`),
                JSON.stringify(fileContent, undefined, 2),
                {
                    encoding: "utf8",
                }
            )
        },
        { concurrency: 10 }
    )
    console.log(
        `Finished generating explorer versions files for ${explorerSlugs.length} explorers`
    )
}
