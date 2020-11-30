import * as db from "./db"
import { syncDatasetToGitRepo } from "adminSiteServer/gitDataExport"
import { Dataset } from "./model/Dataset"

async function main() {
    await db.connect()
    for (const dataset of await Dataset.find({ namespace: "owid" })) {
        if (!dataset.isPrivate)
            await syncDatasetToGitRepo(dataset.id, { commitOnly: true })
    }
    await db.end()
}

main()
