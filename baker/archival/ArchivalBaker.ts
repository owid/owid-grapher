import { AssetMap, JsonString, parseChartConfig } from "@ourworldindata/types"
import fs from "fs-extra"
import { keyBy } from "lodash"
import path from "path"
import * as db from "../../db/db.js"
import { getAllImages } from "../../db/model/Image.js"
import { getVariableData } from "../../db/model/Variable.js"
import findProjectBaseDir from "../../settings/findBaseDir.js"
import { bakeSingleGrapherPageForArchival } from "../GrapherBaker.js"
import { hashAndCopyFile, hashAndWriteFile } from "./ArchivalFileUtils.js"
import {
    ArchivalManifest,
    assembleManifest,
    getDateForArchival,
} from "./ArchivalUtils.js"
import pMap from "p-map"
import { GrapherChecksumsObjectWithHash } from "./ArchivalChecksumUtils.js"

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

export const bakeDods = async (archiveDir: string) => {
    const srcFile = path.join(projBaseDir, "localBake/dods.json")
    const targetDir = path.join(archiveDir, "assets")

    const newFilename = await hashAndCopyFile(srcFile, targetDir, archiveDir)
    return { "dods.json": `/${newFilename}` }
}

const bakeVariableDataFiles = async (
    variableId: number,
    archiveDir: string
) => {
    const { data, metadata } = await getVariableData(variableId)
    const dataStringified = JSON.stringify(data)
    const metadataStringified = JSON.stringify(metadata)

    const dataFilename = `api/v1/indicators/${variableId}.data.json`
    const metadataFilename = `api/v1/indicators/${variableId}.metadata.json`

    const [dataFilenameWithHash, metadataFilenameWithHash] = await Promise.all([
        hashAndWriteFile(dataFilename, dataStringified, archiveDir),
        hashAndWriteFile(metadataFilename, metadataStringified, archiveDir),
    ])

    return {
        [path.basename(dataFilename)]: `/${dataFilenameWithHash}`,
        [path.basename(metadataFilename)]: `/${metadataFilenameWithHash}`,
    }
}

const bakeOwidMjsFile = async (
    srcPath: string,
    destPath: string,
    sourceMapFilename: string,
    archiveDir: string
) => {
    const mjsContents = await fs.readFile(srcPath, "utf8")
    const withSourceMap = mjsContents.replace(
        /\/\/# sourceMappingURL=owid.mjs.map/g,
        `//# sourceMappingURL=${sourceMapFilename}`
    )

    if (withSourceMap === mjsContents) {
        console.error("Failed to replace sourceMappingURL in owid.mjs")
    }
    return await hashAndWriteFile(destPath, withSourceMap, archiveDir)
}

// we explicitly want owid.mjs.map to come first, so that we can replace the sourceMappingURL in owid.mjs
// after we know the content-hashed filename of owid.map.mjs
const ASSET_FILES = ["owid.mjs.map", "owid.mjs", "owid.css"]
const IGNORED_FILES = [".vite"]
export const bakeAssets = async (archiveDir: string) => {
    const srcDir = path.join(projBaseDir, "dist/assets")
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
                sourceMapFilename,
                archiveDir
            )
        } else {
            outFilename = await hashAndCopyFile(srcFile, targetDir, archiveDir)
        }
        staticAssetMap[filename] = `/${outFilename}`
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
    return Object.assign({}, ...results)
}

export const bakeGrapherPagesToFolder = async (
    dir: string,
    grapherChecksumsObjsToBeArchived: GrapherChecksumsObjectWithHash[],
    { copyToLatestDir = false }: { copyToLatestDir?: boolean } = {}
) => {
    const archiveDir = path.resolve(projBaseDir, dir)

    const date = getDateForArchival()
    dir = path.join(archiveDir, date.formattedDate)
    await fs.mkdirp(path.join(dir, "grapher"))

    await copyPublicDir(archiveDir)
    const { staticAssetMap } = await bakeAssets(archiveDir)

    console.log(`Baking site locally to dir '${dir}'`)

    const commonRuntimeFiles = await bakeDods(archiveDir)

    const manifests: Record<number, ArchivalManifest> = {}
    await db.knexReadonlyTransaction(async (trx) => {
        const imageMetadataDictionary = await getAllImages(trx).then((images) =>
            keyBy(images, "filename")
        )

        const grapherIds = grapherChecksumsObjsToBeArchived.map(
            (c) => c.chartId
        )
        const grapherConfigs = await db
            .knexRaw<{
                chartId: number
                chartConfigId: string
                fullConfig: JsonString
            }>(
                trx,
                `-- sql
            SELECT c.id AS chartId, cc.id AS chartConfigId, cc.full AS fullConfig
            FROM charts c
            JOIN chart_configs cc ON cc.id = c.configId
            WHERE c.id IN (?)
        `,
                [grapherIds]
            )
            .then((rows) =>
                rows.map((r) => ({
                    chartId: r.chartId,
                    chartConfigId: r.chartConfigId,
                    config: parseChartConfig(r.fullConfig),
                }))
            )
        const allVariableIds = new Set(
            grapherConfigs.flatMap(
                (c) => c.config.dimensions?.map((d) => d.variableId) ?? []
            )
        )
        const variableFiles = await archiveVariableIds(
            [...allVariableIds],
            archiveDir
        )

        let i = 0
        for (const { chartId, chartConfigId, config } of grapherConfigs) {
            i++
            const runtimeFiles = { ...commonRuntimeFiles }

            for (const dim of config.dimensions ?? []) {
                if (dim.variableId) {
                    const variableId = dim.variableId
                    Object.assign(runtimeFiles, variableFiles[variableId])
                }
            }

            const checksumsObj = grapherChecksumsObjsToBeArchived.find(
                (c) => c.chartId === chartId
            )
            if (!checksumsObj)
                throw new Error(
                    `Could not find checksums for chartId ${chartId}, this shouldn't happen`
                )

            const manifest = await assembleManifest({
                staticAssetMap,
                runtimeAssetMap: runtimeFiles,
                checksumsObj,
                archivalDate: date.formattedDate,
                chartConfigId,
            })
            await bakeSingleGrapherPageForArchival(dir, config, trx, {
                imageMetadataDictionary,
                staticAssetMap,
                runtimeAssetMap: runtimeFiles,
                manifest,
            })
            manifests[chartId] = manifest

            console.log(`${i}/${grapherConfigs.length} ${config.slug}`)
        }
        console.log(`Baked ${grapherConfigs.length} grapher pages`)
    })

    if (copyToLatestDir) {
        const latestDir = path.join(archiveDir, "latest")
        await fs.remove(latestDir)
        await fs.copy(dir, latestDir)
        console.log(`Copied ${dir} to ${latestDir}`)
    }

    return { date, manifests }
}
