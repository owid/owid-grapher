import * as db from "../db/db.js"
import { syncDatasetToGitRepo } from "./gitDataExport.js"
import { Dataset } from "../db/model/Dataset.js"

const main = async () => {
    await db.getConnection()
    for (const dataset of await Dataset.find({ namespace: "owid" })) {
        if (!dataset.isPrivate && !dataset.nonRedistributable)
            await syncDatasetToGitRepo(dataset.id, { commitOnly: true })
    }
    await db.closeTypeOrmAndKnexConnections()
}

main()
