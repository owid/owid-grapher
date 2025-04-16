import {
    ArchiveMetaInformation,
    ArchiveSiteNavigationInfo,
    AssetMap,
    DbEnrichedImage,
    DbPlainArchivedChartVersion,
    GrapherInterface,
    UrlAndMaybeDate,
} from "@ourworldindata/types"
import fs from "fs-extra"
import { keyBy } from "lodash-es"
import path from "path"
import * as db from "../../db/db.js"
import { getAllImages } from "../../db/model/Image.js"
import { getVariableData } from "../../db/model/Variable.js"
import findProjectBaseDir from "../../settings/findBaseDir.js"
import { bakeSingleGrapherPageForArchival } from "../GrapherBaker.js"
import { hashAndCopyFile, hashAndWriteFile } from "./archivalFileUtils.js"
import {
    ArchivalManifest,
    ArchivalTimestamp,
    assembleGrapherArchivalUrl,
    assembleManifest,
    getDateForArchival,
} from "./archivalUtils.js"
import pMap from "p-map"
import {
    getLatestArchivedVersionsFromDb,
    GrapherChecksumsObjectWithHash,
} from "./archivalChecksum.js"
import { GdocPost } from "../../db/model/Gdoc/GdocPost.js"
import { GDOCS_DETAILS_ON_DEMAND_ID } from "../../settings/serverSettings.js"
import { getEnrichedChartsByIds } from "../../db/model/Chart.js"

export const projBaseDir = findProjectBaseDir(__dirname)
if (!projBaseDir) throw new Error("Could not find project base directory")

const IGNORED_FILES_PATTERNS = [
    /^_headers$/,
    /\.DS_Store$/,
    /^images(\/.*)?$/,
    /^sdg.*$/,
    /^identifyadmin.html$/,
    /^robots.txt$/,
]
export const copyPublicDir = async (archiveDir: string) => {
    const publicDir = path.join(projBaseDir, "public")
    const targetDir = archiveDir
    const ignoredFilesPattern = new RegExp(
        IGNORED_FILES_PATTERNS.map((p) => p.source).join("|")
    )
    await fs.copy(publicDir, targetDir, {
        overwrite: true,
        filter: (src) => {
            const relativePath = path.relative(publicDir, src)
            if (ignoredFilesPattern.test(relativePath)) {
                console.log(`Ignoring ${relativePath}`)
                return false
            }
            return true
        },
    })
}

export const bakeDods = async (
    knex: db.KnexReadonlyTransaction,
    archiveDir: string
) => {
    if (!GDOCS_DETAILS_ON_DEMAND_ID) {
        throw new Error(
            "GDOCS_DETAILS_ON_DEMAND_ID not set. Unable to bake dods."
        )
    }

    const { details, parseErrors } = await GdocPost.getDetailsOnDemandGdoc(knex)
    if (parseErrors.length) {
        throw new Error(
            `Error(s) baking details: ${parseErrors
                .map((e) => e.message)
                .join(", ")}`
        )
    }

    if (details) {
        const targetPath = path.join(archiveDir, "assets", "dods.json")
        const resultFilename = await hashAndWriteFile(
            targetPath,
            JSON.stringify(details)
        ).then((fullPath) => path.basename(fullPath))

        return { "dods.json": `/assets/${resultFilename}` }
    } else {
        throw Error("Details on demand not found")
    }
}

const bakeVariableDataFiles = async (
    variableId: number,
    archiveDir: string
) => {
    const { data, metadata } = await getVariableData(variableId)
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

const archiveVariableIds = async (
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

interface MinimalChartInfo {
    chartId: number
    chartConfigId: string
    config: GrapherInterface
}

const assembleCommonBakeInformation = async (
    knex: db.KnexReadonlyTransaction,
    archiveDir: string,
    grapherChecksumsObjsToBeArchived: GrapherChecksumsObjectWithHash[]
) => {
    const commonRuntimeFiles = await bakeDods(knex, archiveDir)
    const imageMetadataDictionary = await getAllImages(knex).then((images) =>
        keyBy(images, "filename")
    )

    const grapherIds = grapherChecksumsObjsToBeArchived.map((c) => c.chartId)
    const latestArchivalVersions = await getLatestArchivedVersionsFromDb(
        knex,
        grapherIds
    ).then((rows) => keyBy(rows, (v) => v.grapherId))
    const grapherConfigs = await getEnrichedChartsByIds(knex, grapherIds).then(
        (rows) =>
            rows.map((r) => ({
                chartId: r.id,
                chartConfigId: r.configId,
                config: r.config,
            }))
    )
    if (grapherIds.length !== grapherConfigs.length)
        throw new Error("Couldn't find some grapher config during archival")
    const allVariableIds = new Set(
        grapherConfigs.flatMap(
            (c) => c.config.dimensions?.map((d) => d.variableId) ?? []
        )
    )

    return {
        commonRuntimeFiles,
        imageMetadataDictionary,
        latestArchivalVersions,
        allVariableIds,
        grapherConfigs,
    }
}

export const bakeArchivalGrapherPagesToFolder = async (
    knex: db.KnexReadonlyTransaction,
    dir: string,
    grapherChecksumsObjsToBeArchived: GrapherChecksumsObjectWithHash[],
    { shouldCopyToLatestDir = false }: { shouldCopyToLatestDir?: boolean } = {}
) => {
    const archiveDir = path.resolve(projBaseDir, dir)

    const date = getDateForArchival()
    dir = path.join(archiveDir, date.formattedDate)
    await fs.mkdirp(path.join(dir, "grapher"))

    await copyPublicDir(archiveDir)
    const { staticAssetMap } = await bakeAssets(archiveDir)

    console.log(`Baking site locally to dir '${dir}'`)

    const manifests: Record<number, ArchivalManifest> = {}

    const commonCtx = await assembleCommonBakeInformation(
        knex,
        archiveDir,
        grapherChecksumsObjsToBeArchived
    )

    // There's a curiosity here in that we re-bake variable files even if they didn't change (their checksums are the same), but the grapher config of an underlying chart changed.
    // What's happening in practice is that the variable file is then re-fetched, re-hashed, and is then overriding the existing file under the same name.
    // It's not ideal, but in the grand scheme of things it's not a worry also - the median incremental update will probably touch less than 10 charts and less than 20 variables or so.
    // On the other hand, detecting whether a variable file is up-to-date would require a lot of extra logic.
    const variableFiles = await archiveVariableIds(
        [...commonCtx.allVariableIds],
        archiveDir
    )

    const { grapherConfigs } = commonCtx

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

        await bakeGrapherPageForArchival(knex, dir, grapherInfo, {
            ...commonCtx,
            staticAssetMap,
            variableFiles,
            checksumsObj,
            date,
        }).then((manifest) => {
            manifests[grapherInfo.chartId] = manifest
        })

        console.log(`${i}/${grapherConfigs.length} ${grapherInfo.config.slug}`)
    }
    console.log(`Baked ${grapherConfigs.length} grapher pages`)

    if (shouldCopyToLatestDir) {
        await copyToLatestDir(archiveDir, dir)
    }

    return { date, manifests }
}

interface GrapherBakeContext {
    commonRuntimeFiles: AssetMap
    staticAssetMap: Record<string, string>
    imageMetadataDictionary: Record<string, DbEnrichedImage>
    variableFiles: Record<number, AssetMap>
    checksumsObj: GrapherChecksumsObjectWithHash
    date: ArchivalTimestamp
    latestArchivalVersions: Record<
        number,
        Pick<
            DbPlainArchivedChartVersion,
            "grapherId" | "grapherSlug" | "archivalTimestamp"
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

    const manifest = await assembleManifest({
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
                  previousVersionInfo.grapherSlug
              ),
          }
        : undefined
    const archiveNavigation: ArchiveSiteNavigationInfo = {
        archiveDate: date.date,
        liveUrl: `https://ourworldindata.org/grapher/${config.slug}`,
        previousVersion,
    }
    const archiveInfo: ArchiveMetaInformation = {
        archiveDate: date.date,
        archiveNavigation,
        assets: {
            runtime: runtimeFiles,
            static: staticAssetMap,
        },
    }
    await bakeSingleGrapherPageForArchival(dir, config, trx, {
        imageMetadataDictionary,
        manifest,
        archiveInfo,
    })
    return manifest
}

async function copyToLatestDir(archiveDir: string, dir: string) {
    // we want to copy the baked site to an overwrite-only `latest` directory,
    // where we never delete files, only add new ones or overwrite existing ones

    const latestDir = path.join(archiveDir, "latest")
    await fs.mkdirp(latestDir)

    let filesCopied = 0,
        dirsCopied = 0
    for await (const file of await fs.opendir(dir, { recursive: true })) {
        console.log(`Copying ${file.name}`)
        const relativePath = path.relative(dir, file.path)

        if (file.isDirectory()) {
            dirsCopied++
            await fs.mkdirp(path.join(latestDir, relativePath))
        } else if (file.isFile()) {
            filesCopied++
            await fs.copy(
                path.join(file.path, file.name),
                path.join(latestDir, relativePath, file.name),
                { overwrite: true }
            )
        }
    }

    console.log(
        `Copied ${dir} to ${latestDir} (${filesCopied} files, ${dirsCopied} dirs)`
    )
}
