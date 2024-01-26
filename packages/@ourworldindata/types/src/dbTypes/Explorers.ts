import { JsonString } from "../domainTypes/Various.js"

export const ExplorersTableName = "explorers"
export interface ExplorersRowForInsert {
    config: JsonString
    createdAt?: Date | null
    isPublished: number
    slug: string
    updatedAt?: Date | null
}
export type ExplorersRow = Required<ExplorersRowForInsert>
// TODO: add enriched type and type config properly
