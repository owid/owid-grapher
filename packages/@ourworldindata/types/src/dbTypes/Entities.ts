export const EntitiesTableName = "entities"
export interface DbInsertEntity {
    code?: string | null
    createdAt?: Date
    id?: number
    name: string
    updatedAt?: Date
    validated: number
}
export type DbPlainEntity = Required<DbInsertEntity>
