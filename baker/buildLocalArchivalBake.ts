#! /usr/bin/env node

import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { BakeStep, BakeStepConfig, bakeSteps, SiteBaker } from "./SiteBaker.js"
import fs from "fs-extra"
import path, { normalize } from "path"
import * as db from "../db/db.js"
import { bakeSingleGrapherPageForArchival } from "./GrapherBaker.js"
import { keyBy } from "lodash"
import { getAllImages } from "../db/model/Image.js"
import { getChartConfigBySlug } from "../db/model/Chart.js"
import findProjectBaseDir from "../settings/findBaseDir.js"
import crypto from "crypto"
import { AssetMapEntry } from "@ourworldindata/types"
import { getVariableData } from "../db/model/Variable.js"

const DIR = "archive"

const HASH_LENGTH = 10

const projBaseDir = findProjectBaseDir(__dirname)
if (!projBaseDir) throw new Error("Could not find project base directory")

const hashContent = (strOrBuffer: string | Buffer) => {
    const hash = crypto.createHash("sha256").update(strOrBuffer).digest("hex")
    return hash.substring(0, HASH_LENGTH)
}

const hashFile = async (file: string) => {
    const buf = await fs.readFile(file)
    return hashContent(buf)
}

const hashAndWriteFile = async (filename: string, content: string) => {
    const hash = hashContent(content)
    const targetFilename = filename.replace(/^(.*\/)?([^.]+\.)/, `$1$2${hash}.`)
    console.log(`Writing ${targetFilename}`)
    await fs.mkdirp(path.dirname(targetFilename))
    await fs.writeFile(targetFilename, content)
    return targetFilename
}

const hashAndCopyFile = async (srcFile: string, targetDir: string) => {
    const hash = await hashFile(srcFile)
    const targetFilename = path
        .basename(srcFile)
        .replace(/^(.*\/)?([^.]+\.)/, `$1$2${hash}.`)
    const targetFile = path.join(targetDir, targetFilename)
    console.log(`Copying ${srcFile} to ${targetFile}`)
    await fs.copyFile(srcFile, targetFile)
    return targetFilename
}

const bakeDods = async () => {
    const srcFile = path.join(projBaseDir, "localBake/dods.json")
    const targetDir = path.join(projBaseDir, DIR)

    const newFilename = await hashAndCopyFile(srcFile, targetDir)
    return { "dods.json": newFilename }
}

const bakeVariableDataFiles = async (variableId: number) => {
    const { data, metadata } = await getVariableData(variableId)
    const dataStringified = JSON.stringify(data)
    const metadataStringified = JSON.stringify(metadata)

    const dataFilename = `${variableId}.data.json`
    const metadataFilename = `${variableId}.metadata.json`

    return {
        [dataFilename]: await hashAndWriteFile(
            path.join(projBaseDir, DIR, "data/v1/indicators", dataFilename),
            dataStringified
        ),
        [metadataFilename]: await hashAndWriteFile(
            path.join(projBaseDir, DIR, "data/v1/indicators", metadataFilename),
            metadataStringified
        ),
    }
}

const bakeAssets = async () => {
    const srcDir = path.join(projBaseDir, "dist/assets")
    const targetDir = path.join(projBaseDir, DIR, "assets")

    await fs.mkdirp(targetDir)

    const viteAssetMap: AssetMapEntry = {}

    for (const dirent of await fs.readdir(srcDir, { withFileTypes: true })) {
        if (!dirent.isFile()) continue
        const srcFile = path.join(srcDir, dirent.name)
        viteAssetMap[dirent.name] = await hashAndCopyFile(srcFile, targetDir)
    }
    return { viteAssetMap }
}

const bakeDomainToFolder = async (
    baseUrl = "http://localhost:3000/",
    dir = DIR,
    bakeSteps?: BakeStepConfig
) => {
    dir = normalize(dir)
    await fs.mkdirp(dir)
    await fs.mkdirp(path.join(dir, "grapher"))

    const { viteAssetMap } = await bakeAssets()
    const baker = new SiteBaker(dir, baseUrl, bakeSteps, viteAssetMap)

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
            viteAssetMap,
        })
    }, db.TransactionCloseMode.Close)
}

void yargs(hideBin(process.argv))
    .command<{ baseUrl: string; dir: string; steps?: string[] }>(
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
        },
        async ({ baseUrl, dir, steps }) => {
            const bakeSteps = steps ? new Set(steps as BakeStep[]) : undefined
            await bakeDomainToFolder(baseUrl, dir, bakeSteps)
            process.exit(0)
        }
    )
    .help()
    .alias("help", "h")
    .strict().argv
