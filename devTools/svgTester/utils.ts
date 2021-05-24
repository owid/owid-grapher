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

interface ResultOk<T> {
    kind: "ok"
    value: T
}

interface ResultError<E> {
    kind: "error"
    error: E
}

type Result<T, E> = ResultOk<T> | ResultError<E>
export type SvgRecord = {
    chartId: number
    slug: string
    chartType: ChartTypeName | undefined
    md5: string
    svgFilename: string
}

interface SvgDifference {
    startIndex: number
    referenceSvgFragment: string
    newSvgFragment: string
}

export const svgCsvHeader = `grapherId,slug,chartType,md5,svgFilename`

const resultOk = <T, E>(value: T): Result<T, E> => ({
    kind: "ok",
    value: value,
})
const resultError = <T, E>(error: E): Result<T, E> => ({
    kind: "error",
    error: error,
})

function findFirstDiffIndex(a: string, b: string): number {
    var i = 0
    while (i < a.length && i < b.length && a[i] === b[i]) i++
    if (a.length === b.length && a.length === i) {
        console.log("Weird - everything was the same")
    }
    return i
}

export async function verifySvg(
    newSvg: string,
    newSvgRecord: SvgRecord,
    referenceSvgRecord: SvgRecord,
    referenceSvgsPath: string
): Promise<Result<null, SvgDifference>> {
    console.log(`processing ${newSvgRecord.chartId}`)
    if (newSvgRecord.md5 === referenceSvgRecord.md5) {
        return resultOk(null)
    }
    const referenceSvg = await loadReferenceSvg(
        referenceSvgsPath,
        referenceSvgRecord
    )
    console.log("preparing")
    const preparedNewSvg = prepareSvgForComparision(newSvg)
    const preparedReferenceSvg = prepareSvgForComparision(referenceSvg)
    console.log("prepared")
    const firstDiffIndex = findFirstDiffIndex(
        preparedNewSvg,
        preparedReferenceSvg
    )
    console.log("diffs found")
    return resultError({
        startIndex: firstDiffIndex,
        referenceSvgFragment: preparedReferenceSvg.substr(
            firstDiffIndex - 20,
            40
        ),
        newSvgFragment: preparedNewSvg.substr(firstDiffIndex - 20, 40),
    })
}

export async function writeToFile(
    data: unknown,
    filename: string
): Promise<void> {
    const json = JSON.stringify(data)
    const writeStream = fs.createWriteStream(filename)

    // writeStream.write(json)
    // writeStream.end()

    const gzipStream = createGzip()
    gzipStream.pipe(writeStream)
    gzipStream.write(json)
    gzipStream.end()

    return finished(writeStream)
}
export async function saveGrapherSchemaAndData(
    config: GrapherInterface,
    outDir: string
) {
    const dataDir = path.join(outDir, config.id?.toString() ?? "")
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)
    const configFilename = path.join(dataDir, "config.json.gz")
    const promise1 = writeToFile(config, configFilename)

    const dataFilename = path.join(dataDir, "data.json.gz")
    const grapher = initGrapherForSvgExport(config, "")
    const variableIds = grapher.dimensions.map((d) => d.variableId)

    const promise2 = getVariableData(variableIds).then((vardata) =>
        writeToFile(vardata, dataFilename)
    )

    const settled = await Promise.allSettled([promise1, promise2])
}

export async function renderSvg(dir: string): Promise<[string, SvgRecord]> {
    const [config, data] = await loadGrapherConfigAndData(dir)

    TESTING_ONLY_reset_guid()
    const grapher = initGrapherForSvgExport(config, "")
    const { width, height } = grapher.idealBounds
    const outFilename = buildSvgOutFilename(
        config.slug!,
        "",
        config.version,
        width,
        height
    )

    grapher.receiveLegacyData(data as LegacyVariablesAndEntityKey)
    const svg = grapher.staticSVG
    const svgRecord = {
        chartId: config.id!,
        slug: config.slug!,
        chartType: config.type,
        md5: processSvgAndCalculateHash(svg),
        svgFilename: outFilename,
    }
    return Promise.resolve([svg, svgRecord])
}

const replaceRegexes = [
    // /id="[-\w\d]{1,100}"/g.compile(),
    /-select-[0-9]+-input/g,
]
function prepareSvgForComparision(svg: string) {
    let current = svg
    for (const replaceRegex of replaceRegexes) {
        current = svg.replace(replaceRegex, "")
    }
    return current
}
export function processSvgAndCalculateHash(svg: string): string {
    const processed = prepareSvgForComparision(svg)
    return md5(processed)
}

export async function renderSvgAndSave(
    dir: string,
    outDir: string
): Promise<SvgRecord> {
    const [svg, svgRecord] = await renderSvg(dir)
    const outPath = path.join(outDir, svgRecord.svgFilename)
    await fs.writeFile(outPath, svg)
    return Promise.resolve(svgRecord)
}

export async function readGzippedJsonFile(filename: string): Promise<unknown> {
    console.log(`Reading file ${filename}`)
    const readStream = fs.createReadStream(filename)

    // const content = await getStream(readStream)

    const gzipStream = createGunzip()
    readStream.pipe(gzipStream)
    const content = await getStream(gzipStream)

    return JSON.parse(content)
}

export async function loadReferenceSvg(
    referenceDir: string,
    referenceSvgRecord: SvgRecord
) {
    const referenceFilename = path.join(
        referenceDir,
        referenceSvgRecord.svgFilename
    )
    if (!fs.existsSync(referenceFilename))
        throw `Input directory does not exist ${referenceFilename}`
    const svg = await fs.readFile(referenceFilename, "utf-8")
    return svg
}

export async function loadGrapherConfigAndData(
    inputDir: string
): Promise<[GrapherInterface, unknown]> {
    if (!fs.existsSync(inputDir))
        throw `Input directory does not exist ${inputDir}`

    const configFilename = path.join(inputDir, "config.json.gz")
    const config = (await readGzippedJsonFile(
        configFilename
    )) as GrapherInterface

    const dataFilename = path.join(inputDir, "data.json.gz")
    const data = await readGzippedJsonFile(dataFilename)

    return Promise.resolve([config, data])
}
