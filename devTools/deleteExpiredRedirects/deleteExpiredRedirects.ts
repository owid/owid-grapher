import * as db from "../../db/db.js"
import { deleteExpiredRedirects } from "../../db/model/Redirect.js"

/** This should be run periodically to delete expired redirects. */
async function main() {
    await db.knexReadWriteTransaction(async (trx) => {
        await deleteExpiredRedirects(trx)
    })
    process.exit(0)
}

void main()
