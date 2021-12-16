import * as fs from "fs-extra"
import path from "path"

import * as db from "./db"
import { JSONAggregator } from "../clientUtils/JSONAggregator"

function exit(msg: string): void {
    console.error(msg)
    process.exit(1)
}

async function streamSql(
    query: string,
    consume: (row: any) => void
): Promise<void> {
    return new Promise(async (resolve) => {
        const conn = await db.getConnection()

        // Create stream so we minimise the RAM necessary to process this big query
        const queryRunner = conn.createQueryRunner()
        const resultStream = await queryRunner.stream(query)

        resultStream.on("data", consume)
        resultStream.on("error", (error) => {
            console.log("error", error)
            throw error
        })
        resultStream.on("end", async () => {
            console.log("end")
            // await conn.close()
            resolve()
        })
    })
}

async function main(): Promise<void> {
    const [scriptPath, outputFileName] = process.argv.slice(1) as [
        string,
        ...(string | undefined)[]
    ]

    if (!outputFileName) {
        exit(`Usage: ${path.basename(scriptPath)} <output_file_name>`)
        return
    }

    const aggregator = new JSONAggregator()

    const sqlQuery = `
        SELECT config
        FROM charts
        WHERE config->"$.isPublished"
    `

    await streamSql(sqlQuery, (row) => aggregator.aggregateSingle(row.config))

    await db.closeTypeOrmAndKnexConnections()

    const outputFilePath = path.resolve(
        path.join(
            __dirname,
            "..",
            "..",
            "baked-json-inspector",
            "output",
            `${outputFileName}.json`
        )
    )

    // Erase file if it already exists
    if (fs.existsSync(outputFilePath)) {
        await fs.truncate(outputFilePath)
    }

    await fs.writeFile(outputFilePath, JSON.stringify(aggregator.toJSON()))

    console.log(`Created ${outputFilePath}`)
    console.log("Remember to update index.html to contain this file.")
}

main()
