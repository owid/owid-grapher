export const EntitiesTableName = "entities"
export interface DbInsertEntity {
    code?: string | null
    createdAt?: Date
    displayName: string
    id?: number
    name: string
    updatedAt?: Date | null
    validated: number
}
export type DbPlainEntity = Required<DbInsertEntity>
