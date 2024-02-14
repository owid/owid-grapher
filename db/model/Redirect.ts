import { Knex } from "knex"
import { DbPlainRedirect } from "@ourworldindata/types"

export const getRedirectsFromDb = async (
    knex: Knex<any, any[]>
): Promise<DbPlainRedirect[]> => {
    const redirectsFromDb: DbPlainRedirect[] = (
        await knex.raw(`
        SELECT source, target, code FROM redirects
        `)
    )[0]

    return redirectsFromDb
}
