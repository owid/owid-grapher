import * as path from "path"
import * as fs from "fs-extra"
import parseArgs from "minimist"
import lodash from "lodash"
import { createObjectCsvStringifier } from "csv-writer"

import * as db from "./db"

const argv = parseArgs(process.argv.slice(2))
const filePath = path.resolve(argv._[0] || "/tmp/owid_variables.csv")

// Use ISO string instead of toString() to stringify dates
function stringifyDateProperties<Obj extends Record<string, unknown>>(
    obj: Obj
): {
    [key in keyof Obj]: Obj[key] extends Date ? string : Obj[key]
} {
    return lodash.mapValues(obj, (value) =>
        value instanceof Date ? value.toISOString() : value
    ) as any
}

const main = async (): Promise<void> => {
    const conn = await db.getConnection()

    const sqlQuery = `
        SELECT
            v.id as variableId, v.name as variableName,
            v.createdAt as variableCreatedAt, v.updatedAt as variableUpdatedAt,
            v.description as variableDescription,
            v.unit as variableUnit, v.shortUnit as variableShortUnit,
            v.display as variableDisplay,

            v.datasetId, d.name as datasetName, d.namespace as datasetNamespace,
            d.createdAt as datasetCreatedAt, d.updatedAt as datasetUpdatedAt,
            d.dataEditedAt as datasetDataEditedAt,
            uc.fullName as datasetCreatedBy, ue.fullName as datasetdataEditedBy,

            v.sourceId, s.name as sourceName,

            cd.chartIds

        FROM variables as v
        LEFT JOIN datasets as d
        ON v.datasetId = d.id
        LEFT JOIN sources as s
        ON v.sourceId = s.id
        LEFT JOIN users as uc
        ON d.createdByUserId = uc.id
        LEFT JOIN users as ue
        ON d.dataEditedByUserId = ue.id
        LEFT JOIN (
            SELECT variableId, JSON_ARRAYAGG(chartId) as chartIds
            FROM chart_dimensions
            GROUP BY variableId
        ) as cd
        ON v.id = cd.variableId
        ORDER BY datasetDataEditedAt DESC;
    `

    const columns = [
        "variableId",
        "variableName",
        "variableCreatedAt",
        "variableUpdatedAt",
        "variableDescription",
        "variableUnit",
        "variableShortUnit",
        "variableDisplay",
        "datasetId",
        "datasetName",
        "datasetNamespace",
        "datasetCreatedAt",
        "datasetUpdatedAt",
        "datasetDataEditedAt",
        "datasetCreatedBy",
        "datasetdataEditedBy",
        "sourceId",
        "sourceName",
        "chartIds",
    ]

    // Erase file if it already exists
    if (fs.existsSync(filePath)) {
        await fs.truncate(filePath)
    }

    // Create stream so we minimise the RAM necessary to process this big query
    const queryRunner = conn.createQueryRunner()
    const resultStream = await queryRunner.stream(sqlQuery)

    const csvStringifier = createObjectCsvStringifier({
        header: columns.map((col) => ({
            id: col,
            title: col,
        })),
    })

    const fileStream = fs.createWriteStream(filePath, { flags: "a" })
    fileStream.write(csvStringifier.getHeaderString())

    resultStream.on("data", (data) =>
        fileStream.write(
            csvStringifier.stringifyRecords([
                stringifyDateProperties(data as any),
            ])
        )
    )
    resultStream.on("error", (error) => {
        throw error
    })
    resultStream.on("end", async () => {
        fileStream.close()
        await db.closeTypeOrmAndKnexConnections()
    })
}

main()
