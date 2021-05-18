#! /usr/bin/env node

import {
    initGrapherForSvgExport,
    getPublishedGraphersBySlug,
} from "../../baker/GrapherImageBaker"
import { getVariableData } from "../../db/model/Variable"
import { closeTypeOrmAndKnexConnections } from "../../db/db"
import { createGzip } from "zlib"
import { pipeline } from "stream"
//import { createWriteStream } from "fs"
import * as fs from "fs-extra"
import * as stream from "stream"
import * as path from "path"
import * as util from "util"

const finished = util.promisify(stream.finished) // (A)

async function writeToFile(data: unknown, filename: string): Promise<void> {
    const json = JSON.stringify(data)
    const writeStream = fs.createWriteStream(filename)
    const gzipStream = createGzip()
    //const gzippedOutputStream = pipeline(gzipStream, writeStream)
    const gzippedOutputStream = gzipStream.pipe(writeStream)

    gzippedOutputStream.write(json)
    writeStream.end()
    return finished(writeStream)
}

async function main() {
    const outDir = "grapherData"
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir)
    const { graphersBySlug, graphersById } = await getPublishedGraphersBySlug(
        false
    )
    let i = 0
    for (const [slug, config] of graphersBySlug) {
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

        if (i > 10) {
            break
        }
        i++
    }
    await closeTypeOrmAndKnexConnections()
    console.log("Done")
}

main()
