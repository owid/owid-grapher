#! /usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
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
import { hashBase36, hashBase36FromStream } from "../serverUtils/hash.js"
import * as Sentry from "@sentry/node"

const DATE_TIME_FORMAT = "YYYYMMDD-HHmmss"
const DIR = "archive"

const projBaseDir = findProjectBaseDir(__dirname)
if (!projBaseDir) throw new Error("Could not find project base directory")

const archiveDir = path.join(projBaseDir, DIR)

const hashFile = async (file: string) => {
    const stream = await fs.createReadStream(file)
    return await hashBase36FromStream(stream)
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
const bakeAssets = async () => {
    const srcDir = path.join(projBaseDir, "dist/assets")
    const targetDir = path.join(projBaseDir, DIR, "assets")

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
                .option("latestDir", {
                    type: "boolean",
                    description:
                        "Copy the baked site to a 'latest' directory, for ease of testing",
                })
        },
        async ({ baseUrl, dir, latestDir }) => {
            await bakeDomainToFolder(baseUrl, dir, {
                copyToLatestDir: latestDir,
            }).catch(async (e) => {
                console.error("Error in buildLocalArchivalBake:", e)
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
