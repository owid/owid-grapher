import * as db from "../db/db"
import { syncDatasetToGitRepo } from "./gitDataExport"
import { Dataset } from "../db/model/Dataset"

const main = async () => {
    await db.connect()
    for (const dataset of await Dataset.find({ namespace: "owid" })) {
        if (!dataset.isPrivate)
            await syncDatasetToGitRepo(dataset.id, { commitOnly: true })
    }
    await db.closeTypeOrmAndKnexConnections()
}

main()
