import { Writable } from "stream"

import * as db from "../db.js"
import { writeVariableCSV } from "./Variable.js"
import _ from "lodash"
import { DbPlainDataset, DatasetsTableName } from "@ourworldindata/types"

// @Entity("datasets")
// @Unique(["name", "namespace"])
// export class Dataset extends BaseEntity {
//     @PrimaryGeneratedColumn() id!: number
//     @Column() name!: string
//     @Column({ default: "owid" }) namespace!: string
//     @Column({ default: "" }) description!: string
//     @Column() createdAt!: Date
//     @Column() updatedAt!: Date
//     @Column() metadataEditedAt!: Date
//     @Column() metadataEditedByUserId!: number
//     @Column() dataEditedAt!: Date
//     @Column() dataEditedByUserId!: number
//     @Column({ default: false }) isPrivate!: boolean
//     @Column({ default: false }) nonRedistributable!: boolean

//     @ManyToOne(() => User, (user) => user.createdDatasets)
//     createdByUser!: Relation<User>
// }

export async function getDatasetById(
    knex: db.KnexReadonlyTransaction,
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
    knex: db.KnexReadonlyTransaction,
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

export async function setTagsForDataset(
    trx: db.KnexReadWriteTransaction,
    datasetId: number,
    tagIds: number[]
): Promise<void> {
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
}
