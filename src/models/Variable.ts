import {Table, Column, Model} from 'sequelize-typescript'

@Table({ tableName: 'variables' })
export default class Variable extends Model<Variable> {
    @Column
    name!: string
}

import * as db from '../db'

export async function getVariableData(variableIds: number[]): Promise<string> {
    const meta: any = { variables: {} }

    const variableQuery = db.query(`
        SELECT v.*, v.short_unit as shortUnit, d.name as datasetName, s.id as s_id, s.name as s_name, s.description as s_description FROM variables as v
            JOIN datasets as d ON v.fk_dst_id = d.id
            JOIN sources as s on v.sourceId = s.id
            WHERE v.id IN (?)
    `, [variableIds])

    const dataQuery = db.query(`
            SELECT value, year, fk_var_id as variableId, entities.id as entityId,
            entities.name as entityName, entities.code as entityCode
            FROM data_values
            LEFT JOIN entities ON data_values.fk_ent_id = entities.id
            WHERE data_values.fk_var_id IN (?)
            ORDER BY variableId ASC, year ASC
    `, [variableIds])

    const variables = await variableQuery

    for (const row of variables) {
        row.shortUnit = row.short_unit; delete row.short_unit
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
        meta.variables[row.id] = row
    }

    const results = await dataQuery

    let output = ""
    function write(s: string) {
        output += s
    }

    write(JSON.stringify(meta))

    const entityKey: { [entityId: number]: { name: string, code: string } | undefined } = {}
    const seenVariables: { [variableId: number]: true | undefined } = {}

    for (const row of results) {
        if (seenVariables[row.variableId] === undefined) {
            seenVariables[row.variableId] = true
            write("\r\n")
            write(row.variableId.toString())
        }

        write(`;${row.year},${row.entityId},${row.value}`)

        if (entityKey[row.entityId] === undefined) {
            entityKey[row.entityId] = { name: row.entityName, code: row.entityCode }
        }
    }

    write("\r\n")
    write(JSON.stringify(entityKey))

    return output
}