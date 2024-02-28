import { DbPlainRedirect } from "@ourworldindata/types"
import * as db from "../db"

export const getRedirectsFromDb = async (
    knex: db.KnexReadonlyTransaction
): Promise<DbPlainRedirect[]> => {
    const redirectsFromDb: DbPlainRedirect[] = await db.knexRaw(
        knex,
        `
        SELECT source, target, code FROM redirects
        `
    )

    return redirectsFromDb
}
