import { Knex } from "knex"
import { DbPlainRedirect } from "@ourworldindata/types"
import * as db from "../db"

export const getRedirectsFromDb = async (
    knex: Knex<any, any[]>
): Promise<DbPlainRedirect[]> => {
    const redirectsFromDb: DbPlainRedirect[] = await db.knexRaw(
        `
        SELECT source, target, code FROM redirects
        `,
        knex
    )

    return redirectsFromDb
}
