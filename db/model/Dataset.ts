import { Writable } from "stream"

import * as db from "../db.js"
import { getVariableUsagesByIds, writeVariableCSV } from "./Variable.js"
import * as _ from "lodash-es"
import {
    DbPlainDataset,
    DatasetsTableName,
    VariablesTableName,
} from "@ourworldindata/types"

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

/**
 * Check if any variables from a dataset are currently in use in charts, explorers, or MDims
 */
export async function checkDatasetVariablesInUse(
    trx: db.KnexReadonlyTransaction,
    datasetId: number
): Promise<{
    inUse: boolean
    usageDetails: {
        chartsCount: number
        explorersCount: number
        multiDimCount: number
    }
}> {
    const variableIds = await db.knexRaw<{ id: number }>(
        trx,
        `SELECT id FROM ${VariablesTableName} WHERE datasetId = ?`,
        [datasetId]
    )
    const usages = [
        ...(
            await getVariableUsagesByIds(
                trx,
                variableIds.map((v) => v.id)
            )
        ).values(),
    ]

    const chartsCount = new Set(
        usages.flatMap((u) => u.charts.map((chart) => chart.id))
    ).size
    const explorersCount = new Set(usages.flatMap((u) => u.explorerSlugs)).size
    const multiDimCount = new Set(
        usages.flatMap((u) => u.multiDims.map((multiDim) => multiDim.id))
    ).size

    return {
        inUse: chartsCount > 0 || explorersCount > 0 || multiDimCount > 0,
        usageDetails: { chartsCount, explorersCount, multiDimCount },
    }
}
