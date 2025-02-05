#! /usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { BakeStep, bakeSteps } from "./SiteBaker.js"
import fs from "fs-extra"
import path, { normalize } from "path"
import * as db from "../db/db.js"
import { bakeSingleGrapherPageForArchival } from "./GrapherBaker.js"
import { keyBy } from "lodash"
import { getAllImages } from "../db/model/Image.js"
import { getChartConfigBySlug } from "../db/model/Chart.js"
import findProjectBaseDir from "../settings/findBaseDir.js"
import { AssetMap } from "@ourworldindata/types"
import { getVariableData } from "../db/model/Variable.js"
import dayjs from "dayjs"
import { hashBase36 } from "../serverUtils/hash.js"

const DATE_TIME_FORMAT = "YYYYMMDD-HHmmss"
const DIR = "archive"

const projBaseDir = findProjectBaseDir(__dirname)
if (!projBaseDir) throw new Error("Could not find project base directory")

const archiveDir = path.join(projBaseDir, DIR)

const hashFile = async (file: string) => {
    const buf = await fs.readFile(file)
    return hashBase36(buf)
}

const hashAndWriteFile = async (filename: string, content: string) => {
    const hash = hashBase36(content)
    const targetFilename = filename.replace(/^(.*\/)?([^.]+\.)/, `$1$2${hash}.`)
    console.log(`Writing ${targetFilename}`)
    const fullTargetFilename = path.resolve(archiveDir, targetFilename)
    await fs.mkdirp(path.dirname(fullTargetFilename))
    await fs.writeFile(fullTargetFilename, content)
    return path.relative(archiveDir, fullTargetFilename)
}

const hashAndCopyFile = async (srcFile: string, targetDir: string) => {
    const hash = await hashFile(srcFile)
    const targetFilename = path
        .basename(srcFile)
        .replace(/^(.*\/)?([^.]+\.)/, `$1$2${hash}.`)
    const targetFile = path.resolve(archiveDir, targetDir, targetFilename)
    console.log(`Copying ${srcFile} to ${targetFile}`)
    await fs.copyFile(srcFile, targetFile)
    return path.relative(archiveDir, targetFile)
}

const IGNORED_FILES_PATTERNS = [
    /^_headers$/,
    /\.DS_Store$/,
    /^images(\/.*)?$/,
    /^sdg.*$/,
    /^identifyadmin.html$/,
    /^robots.txt$/,
]
const copyPublicDir = async () => {
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

const bakeDods = async () => {
    const srcFile = path.join(projBaseDir, "localBake/dods.json")
    const targetDir = path.join(archiveDir, "assets")

    const newFilename = await hashAndCopyFile(srcFile, targetDir)
    return { "dods.json": `/${newFilename}` }
}

const bakeVariableDataFiles = async (variableId: number) => {
    const { data, metadata } = await getVariableData(variableId)
    const dataStringified = JSON.stringify(data)
    const metadataStringified = JSON.stringify(metadata)

    const dataFilename = `api/v1/indicators/${variableId}.data.json`
    const metadataFilename = `api/v1/indicators/${variableId}.metadata.json`

    const [dataFilenameWithHash, metadataFilenameWithHash] = await Promise.all([
        hashAndWriteFile(dataFilename, dataStringified),
        hashAndWriteFile(metadataFilename, metadataStringified),
    ])

    return {
        [path.basename(dataFilename)]: `/${dataFilenameWithHash}`,
        [path.basename(metadataFilename)]: `/${metadataFilenameWithHash}`,
    }
}

const bakeAssets = async () => {
    const srcDir = path.join(projBaseDir, "dist/assets")
    const targetDir = path.join(projBaseDir, DIR, "assets")

    await fs.mkdirp(targetDir)

    const staticAssetMap: AssetMap = {}

    for (const dirent of await fs.readdir(srcDir, { withFileTypes: true })) {
        if (!dirent.isFile()) continue
        const srcFile = path.join(srcDir, dirent.name)
        const filename = await hashAndCopyFile(srcFile, targetDir)
        staticAssetMap[dirent.name] = `/${filename}`
    }
    return { staticAssetMap }
}

const bakeDomainToFolder = async (
    baseUrl = "http://localhost:3000/",
    dir = DIR,
    { copyToLatestDir = false }: { copyToLatestDir?: boolean } = {}
) => {
    const dateTimeFormatted = dayjs().utc().format(DATE_TIME_FORMAT)
    dir = path.join(normalize(dir), dateTimeFormatted)
    await fs.mkdirp(dir)
    await fs.mkdirp(path.join(dir, "grapher"))

    await copyPublicDir()
    const { staticAssetMap } = await bakeAssets()

    console.log(`Baking site locally with baseUrl '${baseUrl}' to dir '${dir}'`)

    const SLUG = "life-expectancy"

    const commonRuntimeFiles = await bakeDods()

    await db.knexReadonlyTransaction(async (trx) => {
        const imageMetadataDictionary = await getAllImages(trx).then((images) =>
            keyBy(images, "filename")
        )
        const chart = await getChartConfigBySlug(trx, SLUG)

        const runtimeFiles = { ...commonRuntimeFiles }

        for (const dim of chart.config.dimensions ?? []) {
            if (dim.variableId) {
                const variableId = dim.variableId
                const variableFiles = await bakeVariableDataFiles(variableId)
                Object.assign(runtimeFiles, variableFiles)
            }
        }

        await bakeSingleGrapherPageForArchival(dir, chart.config, trx, {
            imageMetadataDictionary,
            staticAssetMap,
            runtimeAssetMap: runtimeFiles,
        })
    }, db.TransactionCloseMode.Close)

    if (copyToLatestDir) {
        const latestDir = path.join(DIR, "latest")
        await fs.remove(latestDir)
        await fs.copy(dir, latestDir)
        console.log(`Copied ${dir} to ${latestDir}`)
    }
}

void yargs(hideBin(process.argv))
    .command<{
        baseUrl: string
        dir: string
        steps?: string[]
        latestDir?: boolean
    }>(
        "$0 [baseUrl] [dir]",
        "Bake the site to a local folder",
        (yargs) => {
            yargs
                .positional("baseUrl", {
                    type: "string",
                    default: "http://localhost:3000/",
                    describe: "Base URL of the site",
                })
                .positional("dir", {
                    type: "string",
                    default: "archive",
                    describe: "Directory to save the baked site",
                })
                .option("steps", {
                    type: "array",
                    choices: bakeSteps,
                    description: "Steps to perform during the baking process",
                })
                .option("latestDir", {
                    type: "boolean",
                    description:
                        "Copy the baked site to a 'latest' directory, for ease of testing",
                })
        },
        async ({ baseUrl, dir, steps, latestDir }) => {
            const _bakeSteps = steps ? new Set(steps as BakeStep[]) : undefined
            await bakeDomainToFolder(baseUrl, dir, {
                copyToLatestDir: latestDir,
            })
            process.exit(0)
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
