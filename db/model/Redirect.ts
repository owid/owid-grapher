import * as db from "../db"
import { Redirect } from "@ourworldindata/types"

export const getRedirectsFromDb = async (): Promise<Redirect[]> => {
    const redirectsFromDb = (
        await db.knexInstance().raw(`
        SELECT source, target, code FROM redirects
        `)
    )[0]

    return redirectsFromDb
}
