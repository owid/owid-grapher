import * as lodash from "lodash"
import { Writable } from "stream"
import * as db from "../db.js"
import {
    OwidChartDimensionInterface,
    OwidVariableDisplayConfigInterface,
} from "../../clientUtils/OwidVariableDisplayConfigInterface.js"
import { OwidVariablesAndEntityKey } from "../../clientUtils/OwidVariable.js"
import { arrToCsvRow, omitNullableValues } from "../../clientUtils/Util.js"
import {
    DataValueQueryArgs,
    DataValueResult,
    OwidVariableId,
} from "../../clientUtils/owidTypes.js"
import { OwidSource } from "../../clientUtils/OwidSource.js"

export interface VariableRow {
    id: number
    name: string
    code: string | null
    unit: string
    shortUnit: string | null
    description: string | null
    createdAt: Date
    updatedAt: Date
    datasetId: number
    sourceId: number
    display: OwidVariableDisplayConfigInterface
    coverage?: string
    timespan?: string
    columnOrder?: number
}

export type UnparsedVariableRow = VariableRow & { display: string }

export type Field = keyof VariableRow

export const variableTable = "variables"

export function parseVariableRows(
    plainRows: UnparsedVariableRow[]
): VariableRow[] {
    for (const row of plainRows) {
        row.display = row.display ? JSON.parse(row.display) : undefined
    }
    return plainRows
}

export async function getVariableData(variableIds: number[]): Promise<any> {
    variableIds = lodash.uniq(variableIds)
    const data: OwidVariablesAndEntityKey = { variables: {}, entityKey: {} }

    type VariableQueryRow = Readonly<
        UnparsedVariableRow & {
            display: string
            datasetName: string
            nonRedistributable: number
            sourceName: string
            sourceDescription: string
        }
    >

    const variableQuery: Promise<VariableQueryRow[]> = db.queryMysql(
        `
        SELECT
            variables.*,
            datasets.name AS datasetName,
            datasets.nonRedistributable AS nonRedistributable,
            sources.name AS sourceName,
            sources.description AS sourceDescription
        FROM variables
        JOIN datasets ON variables.datasetId = datasets.id
        JOIN sources ON variables.sourceId = sources.id
        WHERE variables.id IN (?)
        `,
        [variableIds]
    )

    const dataQuery = db.queryMysql(
        `
        SELECT
            value,
            year,
            variableId,
            entities.id AS entityId,
            entities.name AS entityName,
            entities.code AS entityCode
        FROM data_values
        LEFT JOIN entities ON data_values.entityId = entities.id
        WHERE data_values.variableId IN (?)
        ORDER BY
            variableId ASC,
            year ASC
        `,
        [variableIds]
    )

    const variables = await variableQuery

    for (const row of variables) {
        const {
            sourceId,
            sourceName,
            sourceDescription,
            nonRedistributable,
            display: displayJson,
            ...variable
        } = row
        const display = JSON.parse(displayJson)
        const partialSource: OwidSource = JSON.parse(sourceDescription)
        data.variables[variable.id] = {
            ...omitNullableValues(variable),
            nonRedistributable: Boolean(nonRedistributable),
            display,
            source: {
                id: sourceId,
                name: sourceName,
                dataPublishedBy: partialSource.dataPublishedBy || "",
                dataPublisherSource: partialSource.dataPublisherSource || "",
                link: partialSource.link || "",
                retrievedDate: partialSource.retrievedDate || "",
                additionalInfo: partialSource.additionalInfo || "",
            },
            years: [],
            entities: [],
            values: [],
        }
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
                code: row.entityCode,
            }
        }
    }

    return data
}

// TODO use this in Dataset.writeCSV() maybe?
export async function writeVariableCSV(
    variableIds: number[],
    stream: Writable
): Promise<void> {
    const variableQuery: Promise<{ id: number; name: string }[]> =
        db.queryMysql(
            `
            SELECT id, name
            FROM variables
            WHERE id IN (?)
            `,
            [variableIds]
        )

    const dataQuery: Promise<
        {
            variableId: number
            entity: string
            year: number
            value: string
        }[]
    > = db.queryMysql(
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
    const variablesById = lodash.keyBy(variables, "id")

    // Throw an error if not all variables exist
    if (variables.length !== variableIds.length) {
        const fetchedVariableIds = variables.map((v) => v.id)
        const missingVariables = lodash.difference(
            variableIds,
            fetchedVariableIds
        )
        throw Error(`Variable IDs do not exist: ${missingVariables.join(", ")}`)
    }

    variables = variableIds.map((variableId) => variablesById[variableId])

    const columns = ["Entity", "Year"].concat(variables.map((v) => v.name))
    stream.write(arrToCsvRow(columns))

    const variableColumnIndex: { [id: number]: number } = {}
    for (const variable of variables) {
        variableColumnIndex[variable.id] = columns.indexOf(variable.name)
    }

    const data = await dataQuery

    let row: unknown[] = []
    for (const datum of data) {
        if (datum.entity !== row[0] || datum.year !== row[1]) {
            // New row
            if (row.length) {
                stream.write(arrToCsvRow(row))
            }
            row = [datum.entity, datum.year]
            for (const variable of variables) {
                row.push("")
            }
        }
        row[variableColumnIndex[datum.variableId]] = datum.value
    }
}

export const getDataValue = async ({
    variableId,
    entityId,
    year,
}: DataValueQueryArgs): Promise<DataValueResult | undefined> => {
    if (!variableId || !entityId) return

    const queryStart = `
        SELECT
            value,
            year,
            variables.unit AS unit,
            entities.name AS entityName
        FROM data_values
        JOIN entities on entities.id = data_values.entityId
        JOIN variables on variables.id = data_values.variableId
        WHERE entities.id = ?
        AND variables.id = ?`

    const queryStartVariables = [entityId, variableId]

    let row

    if (year) {
        row = await db.mysqlFirst(
            `${queryStart}
            AND data_values.year = ?`,
            [...queryStartVariables, year]
        )
    } else {
        row = await db.mysqlFirst(
            `${queryStart}
            ORDER BY data_values.year DESC
            LIMIT 1`,
            queryStartVariables
        )
    }

    if (!row) return

    return {
        value: Number(row.value),
        year: Number(row.year),
        unit: row.unit,
        entityName: row.entityName,
    }
}

export const getOwidChartDimensionConfigForVariable = async (
    variableId: OwidVariableId,
    chartId: number
): Promise<OwidChartDimensionInterface | undefined> => {
    const row = await db.mysqlFirst(
        `
        SELECT config->"$.dimensions" AS dimensions
        FROM charts
        WHERE id = ?
        `,
        [chartId]
    )
    if (!row.dimensions) return
    const dimensions = JSON.parse(row.dimensions)
    return dimensions.find(
        (dimension: OwidChartDimensionInterface) =>
            dimension.variableId === variableId
    )
}

export const getOwidVariableDisplayConfig = async (
    variableId: OwidVariableId
): Promise<OwidVariableDisplayConfigInterface | undefined> => {
    const row = await db.mysqlFirst(
        `SELECT display FROM variables WHERE id = ?`,
        [variableId]
    )
    if (!row.display) return
    return JSON.parse(row.display)
}
