export const OriginsVariablesTableName = "origins_variables"
export interface DbInsertOriginsVariable {
    displayOrder?: number
    originId: number
    variableId: number
}
export type DbPlainOriginVariable = Required<DbInsertOriginsVariable>
