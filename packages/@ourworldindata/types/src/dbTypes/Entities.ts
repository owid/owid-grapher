export const EntitiesRowTableName = "entities"
export interface EntitiesRowForInsert {
    code?: string | null
    createdAt?: Date
    displayName: string
    id?: number
    name: string
    updatedAt?: Date | null
    validated: number
}
export type EntitiesRow = Required<EntitiesRowForInsert>
