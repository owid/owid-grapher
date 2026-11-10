import { DbEnrichedImage } from "@ourworldindata/types"
import { KnexReadonlyTransaction } from "../db.js"

/**
 * Get all images that haven't been replaced
 **/
export async function getAllImages(
    knex: KnexReadonlyTransaction
): Promise<DbEnrichedImage[]> {
    return knex
        .table("images")
        .where("replacedBy", null)
        .select<DbEnrichedImage[]>()
}

export async function getImagesByFilenames(
    knex: KnexReadonlyTransaction,
    filenames: string[]
): Promise<DbEnrichedImage[]> {
    return knex
        .table("images")
        .where("replacedBy", null)
        .whereIn("filename", filenames)
        .select<DbEnrichedImage[]>()
}
