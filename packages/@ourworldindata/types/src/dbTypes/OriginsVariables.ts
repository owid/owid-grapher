export const OriginsVariablesRowTableName = "origins_variables"
export interface OriginsVariablesRowForInsert {
    displayOrder?: number
    originId: number
    variableId: number
}
export type OriginsVariablesRow = Required<OriginsVariablesRowForInsert>
