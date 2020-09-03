import * as db from "db/db"
import { syncDatasetToGitRepo } from "adminSite/server/utils/gitDataExport"
import { Dataset } from "db/model/Dataset"

async function main() {
    await db.connect()
    for (const dataset of await Dataset.find({ namespace: "owid" })) {
        if (!dataset.isPrivate)
            await syncDatasetToGitRepo(dataset.id, { commitOnly: true })
    }
    await db.end()
}

main()
