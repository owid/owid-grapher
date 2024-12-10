import { DbEnrichedImage, DbRawImage } from "@ourworldindata/types"
import { parseImageRow } from "@ourworldindata/utils"
import { KnexReadonlyTransaction } from "../db.js"

export async function getAllImages(
    knex: KnexReadonlyTransaction
): Promise<DbEnrichedImage[]> {
    const images = await knex.table("images").select<DbRawImage[]>()
    return images.map(parseImageRow)
}
