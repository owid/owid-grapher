import * as db from "../db"
import { DbPlainRedirect } from "@ourworldindata/types"

export const getRedirectsFromDb = async (): Promise<DbPlainRedirect[]> => {
    const redirectsFromDb = (
        await db.knexInstance().raw(`
        SELECT source, target, code FROM redirects
        `)
    )[0]

    return redirectsFromDb
}
