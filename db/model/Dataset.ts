import {
    Entity,
    PrimaryGeneratedColumn,
    Column,
    BaseEntity,
    ManyToOne,
    Unique,
    type Relation,
} from "typeorm"
import { Writable } from "stream"

import { User } from "./User.js"
import { getSourcesForDataset, sourceToDatapackage } from "./Source.js"

import * as db from "../db.js"
import { writeVariableCSV } from "./Variable.js"
import _ from "lodash"
import {
    DbPlainDataset,
    DatasetsTableName,
    DbPlainTag,
    VariablesTableName,
    DbRawVariable,
} from "@ourworldindata/types"
import { Knex } from "knex"

@Entity("datasets")
@Unique(["name", "namespace"])
export class Dataset extends BaseEntity {
    @PrimaryGeneratedColumn() id!: number
    @Column() name!: string
    @Column({ default: "owid" }) namespace!: string
    @Column({ default: "" }) description!: string
    @Column() createdAt!: Date
    @Column() updatedAt!: Date
    @Column() metadataEditedAt!: Date
    @Column() metadataEditedByUserId!: number
    @Column() dataEditedAt!: Date
    @Column() dataEditedByUserId!: number
    @Column({ default: false }) isPrivate!: boolean
    @Column({ default: false }) nonRedistributable!: boolean

    @ManyToOne(() => User, (user) => user.createdDatasets)
    createdByUser!: Relation<User>
}

export async function getDatasetById(
    knex: Knex<any, any[]>,
    datasetId: number
): Promise<DbPlainDataset | undefined> {
    const dataset = await knex<DbPlainDataset>(DatasetsTableName)
        .where({ id: datasetId })
        .first()
    if (!dataset) return undefined
    return {
        ...dataset,
        // for backwards compatibility
        namespace: dataset.namespace ?? "owid",
        description: dataset.description ?? "",
    }
}

// Export dataset variables to CSV (not including metadata)
export async function writeDatasetCSV(
    knex: Knex<any, any[]>,
    datasetId: number,
    stream: Writable
): Promise<void> {
    // get variables of a dataset
    const variableIds = (
        await db.knexRaw<{ variableId: number }>(
            knex,
            `SELECT id as variableId
            FROM variables v
            WHERE datasetId=?`,
            [datasetId]
        )
    ).map((row) => row.variableId)

    await writeVariableCSV(variableIds, stream, knex)
}

export async function datasetToCSV(
    knex: Knex<any, any[]>,
    datasetId: number
): Promise<string> {
    let csv = ""
    await writeDatasetCSV(knex, datasetId, {
        write: (s: string) => (csv += s),
        end: () => null,
    } as any)
    return csv
}

export async function setTagsForDataset(
    knex: Knex<any, any[]>,
    datasetId: number,
    tagIds: number[]
): Promise<void> {
    await knex.transaction(async (trx: Knex<any, any[]>) => {
        const tagRows = tagIds.map((tagId) => [tagId, datasetId])
        await db.knexRaw(trx, `DELETE FROM dataset_tags WHERE datasetId=?`, [
            datasetId,
        ])
        if (tagRows.length)
            await db.knexRaw(
                trx,
                `INSERT INTO dataset_tags (tagId, datasetId) VALUES ?`,

                [tagRows]
            )
    })
}

// Return object representing datapackage.json for this dataset
export async function datasetToDatapackage(
    knex: Knex<any, any[]>,
    datasetId: number
): Promise<any> {
    const datasetName = (await getDatasetById(knex, datasetId))?.name
    const sources = await getSourcesForDataset(knex, datasetId)
    const variables = (await db
        .knexTable(VariablesTableName)
        .where({ datasetId })) as DbRawVariable[]
    const tags = await db.knexRaw<Pick<DbPlainTag, "id" | "name">>(
        knex,
        `SELECT t.id, t.name FROM dataset_tags dt JOIN tags t ON t.id=dt.tagId WHERE dt.datasetId=?`,
        [datasetId]
    )

    const initialFields = [
        { name: "Entity", type: "string" },
        { name: "Year", type: "year" },
    ]

    const dataPackage = {
        name: datasetName,
        title: datasetName,
        id: datasetId,
        description:
            (sources[0] &&
                sources[0].description &&
                sources[0].description.additionalInfo) ||
            "",
        sources: sources.map((s) => sourceToDatapackage(s)),
        owidTags: tags.map((t: any) => t.name),
        resources: [
            {
                path: `${datasetName}.csv`,
                schema: {
                    fields: initialFields.concat(
                        variables.map((v) => ({
                            name: v.name ?? "",
                            type: "any",
                            description: v.description,
                            owidDisplaySettings: v.display,
                        }))
                    ),
                },
            },
        ],
    }

    return dataPackage
}
