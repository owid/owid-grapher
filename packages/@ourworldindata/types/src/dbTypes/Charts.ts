export const ChartsTableName = "charts"
export interface DbInsertChart {
    configId: string
    createdAt?: Date
    id?: number
    is_indexable?: number
    lastEditedAt: Date
    lastEditedByUserId: number
    publishedAt?: Date | null
    publishedByUserId?: number | null
    updatedAt?: Date | null

    // TODO(charts.config):
    // we moved all configs to the `chart_configs` table,
    // but kept the `config` column for now to be on the safe side,
    // with the intention to remove it soon. that's why we pretend
    // it doesn't exist here.

    // config: JsonString
}
export type DbPlainChart = Required<DbInsertChart>
