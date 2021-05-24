import * as stream from "stream"
import * as path from "path"
import { getVariableData } from "../../db/model/Variable"
import {
    initGrapherForSvgExport,
    buildSvgOutFilename,
} from "../../baker/GrapherImageBaker"
import { createGunzip, createGzip } from "zlib"
//import { createWriteStream } from "fs"
import * as fs from "fs-extra"
import getStream from "get-stream"
import { LegacyVariablesAndEntityKey } from "../../grapher/core/LegacyVariableCode"
import { ChartTypeName } from "../../grapher/core/GrapherConstants"
import md5 from "md5"

import * as util from "util"
//import pMap from "p-map"
import { GrapherInterface } from "../../grapher/core/GrapherInterface"
import { TESTING_ONLY_reset_guid } from "../../clientUtils/Util"

export const finished = util.promisify(stream.finished) // (A)

export async function writeToFile(
    data: unknown,
    filename: string
): Promise<void> {
    const json = JSON.stringify(data)
    const writeStream = fs.createWriteStream(filename)
    //const gzipStream = createGzip()
    //const gzippedOutputStream = gzipStream.pipe(writeStream)

    writeStream.write(json)
    writeStream.end()
    return finished(writeStream)
}
export async function saveGrapherSchemaAndData(
    config: GrapherInterface,
    outDir: string
) {
    const dataDir = path.join(outDir, config.id?.toString() ?? "")
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)
    const configFilename = path.join(dataDir, "config.json")
    const promise1 = writeToFile(config, configFilename)

    const dataFilename = path.join(dataDir, "data.json")
    const grapher = initGrapherForSvgExport(config, "")
    const variableIds = grapher.dimensions.map((d) => d.variableId)

    const promise2 = getVariableData(variableIds).then((vardata) =>
        writeToFile(vardata, dataFilename)
    )

    const settled = await Promise.allSettled([promise1, promise2])
}

export async function renderSvg(
    dir: string,
    outDir: string,
    verbose: boolean
): Promise<[string, SvgRecord, string]> {
    const [config, data] = await loadGrapherConfigAndData(dir)

    TESTING_ONLY_reset_guid()
    const grapher = initGrapherForSvgExport(config, "")
    const { width, height } = grapher.idealBounds
    const outPath = buildSvgOutFilename(
        config.slug!,
        "",
        outDir,
        config.version,
        width,
        height,
        verbose
    )
    grapher.receiveLegacyData(data as LegacyVariablesAndEntityKey)
    const svg = grapher.staticSVG
    const svgRecord = {
        chartId: config.id!,
        slug: config.slug!,
        chartType: config.type,
        md5: processSvgAndCalculateHash(svg),
    }
    return Promise.resolve([svg, svgRecord, outPath])
}

const removeIdsRegex = /id="[^"]*"/g.compile()
export function processSvgAndCalculateHash(svg: string): string {
    const processed = svg.replace(removeIdsRegex, "")
    return md5(processed)
}

export async function renderSvgAndSave(
    dir: string,
    outDir: string,
    verbose: boolean
): Promise<SvgRecord> {
    const [svg, svgRecord, outPath] = await renderSvg(dir, outDir, verbose)
    await fs.writeFile(outPath, svg)
    return Promise.resolve(svgRecord)
}

export async function readGzippedJsonFile(filename: string): Promise<unknown> {
    console.log(`Reading file ${filename}`)
    const readStream = fs.createReadStream(filename)
    //const gzipStream = createGunzip()
    //const gzippedInputStream = readStream.pipe(gzipStream)

    const content = await getStream(readStream)

    return JSON.parse(content)
}
export async function loadGrapherConfigAndData(
    inputDir: string
): Promise<[GrapherInterface, unknown]> {
    if (!fs.existsSync(inputDir))
        throw `Input directory does not exist ${inputDir}`

    const configFilename = path.join(inputDir, "config.json")
    const config = (await readGzippedJsonFile(
        configFilename
    )) as GrapherInterface

    const dataFilename = path.join(inputDir, "data.json")
    const data = await readGzippedJsonFile(dataFilename)

    return Promise.resolve([config, data])
}

export type SvgRecord = {
    chartId: number
    slug: string
    chartType: ChartTypeName | undefined
    md5: string
}

export const svgCsvHeader = `grapherId,slug,chartType,md5`
