import * as db from "db/db"
import { Chart } from "db/model/Chart"
import * as fs from "fs-extra"
import { csvRow } from "utils/server/serverUtil"

async function dataExport() {
    await db.connect()

    const slugs = (await fs.readFile("/Users/mispy/tmp/urls.txt", "utf8"))
        .split("\n")
        .filter(s => s.trim())
    const slugToId = await Chart.mapSlugsToIds()
    const idsToGet = slugs.map(slug => slugToId[slug])

    const variables = await db.query(
        "SELECT v.name, v.id FROM variables v JOIN chart_dimensions cd ON cd.variableId=v.id WHERE cd.chartId IN (?)",
        [idsToGet]
    )
    const variableIds = variables.map((v: any) => v.id)
    const stream = fs.createWriteStream("/Users/mispy/tmp/sdgs.csv")

    // From dataset CSV export
    const csvHeader = ["Entity", "Year"]
    for (const variable of variables) {
        csvHeader.push(variable.name)
    }

    const columnIndexByVariableId: { [key: number]: number } = {}
    for (const variable of variables) {
        columnIndexByVariableId[variable.id] = csvHeader.indexOf(variable.name)
    }

    stream.write(csvRow(csvHeader))

    const data = await db.query(
        `
        SELECT e.name AS entity, dv.year, dv.value, dv.variableId FROM data_values dv
        JOIN variables v ON v.id=dv.variableId
        JOIN entities e ON dv.entityId=e.id
        WHERE v.id IN (?)
        ORDER BY e.name ASC, dv.year ASC, dv.variableId ASC`,
        [variableIds]
    )

    let row: string[] = []
    for (const datum of data) {
        if (datum.entity !== row[0] || datum.year !== row[1]) {
            // New row
            if (row.length) {
                stream.write(csvRow(row))
            }
            row = [datum.entity, datum.year]
            for (const variable of variables) {
                row.push("")
            }
        }

        row[columnIndexByVariableId[datum.variableId]] = datum.value
    }

    // Final row
    stream.write(csvRow(row))

    stream.end()

    await db.end()
}

dataExport()
