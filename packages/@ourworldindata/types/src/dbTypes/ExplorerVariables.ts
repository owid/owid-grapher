export const ExplorerVariablesTableName = "explorer_variables"
export interface DbInsertExplorerVariable {
    explorerSlug: string
    id?: number
    variableId: number
}
export type DbPlainExplorerVariable = Required<DbInsertExplorerVariable>
