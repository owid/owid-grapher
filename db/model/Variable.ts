import {Entity, PrimaryGeneratedColumn, Column, BaseEntity, ManyToOne, JoinColumn} from "typeorm"
import * as _ from 'lodash'

import * as db from 'db/db'
import { Dataset } from './Dataset'
import { VariableDisplaySettings } from "charts/VariableData"

export namespace Variable {
    export interface Row {
        id: number
        name: string
        unit: string
        description: string
        columnOrder: number
        display: VariableDisplaySettings
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

    const variableQuery = db.query(`
        SELECT v.*, v.shortUnit, d.name as datasetName, d.id as datasetId, s.id as s_id, s.name as s_name, s.description as s_description FROM variables as v
            JOIN datasets as d ON v.datasetId = d.id
            JOIN sources as s on v.sourceId = s.id
            WHERE v.id IN (?)
    `, [variableIds])

    const dataQuery = db.query(`
            SELECT value, year, variableId as variableId, entities.id as entityId,
            entities.name as entityName, entities.code as entityCode
            FROM data_values
            LEFT JOIN entities ON data_values.entityId = entities.id
            WHERE data_values.variableId IN (?)
            ORDER BY variableId ASC, year ASC
    `, [variableIds])

    const variables = await variableQuery

    for (const row of variables) {
        row.display = JSON.parse(row.display)
        const sourceDescription = JSON.parse(row.s_description); delete row.s_description
        row.source = {
            id: row.s_id,
            name: row.s_name,
            dataPublishedBy: sourceDescription.dataPublishedBy || "",
            dataPublisherSource: sourceDescription.dataPublisherSource || "",
            link: sourceDescription.link || "",
            retrievedData: sourceDescription.retrievedData || "",
            additionalInfo: sourceDescription.additionalInfo || ""
        }
        data.variables[row.id] = _.extend({
            years: [],
            entities: [],
            values: []
        }, row)
    }

    const results = await dataQuery

    for (const row of results) {
        const variable = data.variables[row.variableId]
        variable.years.push(row.year)
        variable.entities.push(row.entityId)

        const asNumber = parseFloat(row.value)
        if (!isNaN(asNumber))
            variable.values.push(asNumber)
        else
            variable.values.push(row.value)

        if (data.entityKey[row.entityId] === undefined) {
            data.entityKey[row.entityId] = { name: row.entityName, code: row.entityCode }
        }
    }

    return data
}
