export const MimsTableName = "mims"

export enum MimIncomeGroup {
    Low = "low",
    LowerMiddle = "lower-middle",
    UpperMiddle = "upper-middle",
    High = "high",
    All = "all",
}

export interface DbInsertMim {
    id?: number
    url: string
    parentTagId: number
    ranking: number
    incomeGroup: MimIncomeGroup
}

export type DbPlainMim = Required<DbInsertMim>
