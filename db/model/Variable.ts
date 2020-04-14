import * as _ from "lodash"
import { Writable } from "stream"

import * as db from "db/db"
import { csvRow } from "utils/server/serverUtil"
import { OwidVariableDisplaySettings } from "charts/owidData/OwidVariable"

export namespace Variable {
    export interface Row {
        id: number
        name: string
        unit: string
        description: string
        columnOrder: number
        display: OwidVariableDisplaySettings
    }

    export type Field = keyof Row

    export const table = "variables"

    export function rows(plainRows: any): Variable.Row[] {
        for (const row of plainRows) {
            row.display = row.display ? JSON.parse(row.display) : undefined
        }
        return plainRows
    }
}

export async function getVariableData(variableIds: number[]): Promise<any> {
    const data: any = { variables: {}, entityKey: {} }

    const variableQuery = db.query(
        `
        SELECT v.*, v.shortUnit, d.name as datasetName, d.id as datasetId, s.id as s_id, s.name as s_name, s.description as s_description FROM variables as v
            JOIN datasets as d ON v.datasetId = d.id
            JOIN sources as s on v.sourceId = s.id
            WHERE v.id IN (?)
    `,
        [variableIds]
    )

    const dataQuery = db.query(
        `
            SELECT value, year, variableId as variableId, entities.id as entityId,
            entities.name as entityName, entities.code as entityCode
            FROM data_values
            LEFT JOIN entities ON data_values.entityId = entities.id
            WHERE data_values.variableId IN (?)
            ORDER BY variableId ASC, year ASC
    `,
        [variableIds]
    )

    const variables = await variableQuery

    for (const row of variables) {
        row.display = JSON.parse(row.display)
        const sourceDescription = JSON.parse(row.s_description)
        delete row.s_description
        row.source = {
            id: row.s_id,
            name: row.s_name,
            dataPublishedBy: sourceDescription.dataPublishedBy || "",
            dataPublisherSource: sourceDescription.dataPublisherSource || "",
            link: sourceDescription.link || "",
            retrievedData: sourceDescription.retrievedData || "",
            additionalInfo: sourceDescription.additionalInfo || ""
        }
        data.variables[row.id] = _.extend(
            {
                years: [],
                entities: [],
                values: []
            },
            row
        )
    }

    const results = await dataQuery

    for (const row of results) {
        const variable = data.variables[row.variableId]
        variable.years.push(row.year)
        variable.entities.push(row.entityId)

        const asNumber = parseFloat(row.value)
        if (!isNaN(asNumber)) variable.values.push(asNumber)
        else variable.values.push(row.value)

        if (data.entityKey[row.entityId] === undefined) {
            data.entityKey[row.entityId] = {
                name: row.entityName,
                code: row.entityCode
            }
        }
    }

    return data
}

// TODO use this in Dataset.writeCSV() maybe?
export async function writeVariableCSV(
    variableIds: number[],
    stream: Writable
) {
    const variableQuery: Promise<{ id: number; name: string }[]> = db.query(
        `
        SELECT id, name
        FROM variables
        WHERE id IN (?)
    `,
        [variableIds]
    )

    const dataQuery: Promise<{
        variableId: number
        entity: string
        year: number
        value: string
    }[]> = db.query(
        `
        SELECT
            data_values.variableId AS variableId,
            entities.name AS entity,
            data_values.year AS year,
            data_values.value AS value
        FROM
            data_values
            JOIN entities ON entities.id = data_values.entityId
            JOIN variables ON variables.id = data_values.variableId
        WHERE
            data_values.variableId IN (?)
        ORDER BY
            data_values.entityId ASC,
            data_values.year ASC
    `,
        [variableIds]
    )

    let variables = await variableQuery
    const variablesById = _.keyBy(variables, "id")

    // Throw an error if not all variables exist
    if (variables.length !== variableIds.length) {
        const fetchedVariableIds = variables.map(v => v.id)
        const missingVariables = _.difference(variableIds, fetchedVariableIds)
        throw Error(`Variable IDs do not exist: ${missingVariables.join(", ")}`)
    }

    variables = variableIds.map(variableId => variablesById[variableId])

    const columns = ["Entity", "Year"].concat(variables.map(v => v.name))
    stream.write(csvRow(columns))

    const variableColumnIndex: { [id: number]: number } = {}
    for (const variable of variables) {
        variableColumnIndex[variable.id] = columns.indexOf(variable.name)
    }

    const data = await dataQuery

    let row: any[] = []
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
        row[variableColumnIndex[datum.variableId]] = datum.value
    }
}
