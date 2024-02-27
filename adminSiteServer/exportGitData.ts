import * as db from "../db/db.js"
import { syncDatasetToGitRepo } from "./gitDataExport.js"
import { DbPlainDataset, DatasetsTableName } from "@ourworldindata/types"

const main = async () => {
    const knex = db.knexInstance()
    const datasets = await knex<DbPlainDataset>(DatasetsTableName).where({
        namespace: "owid",
    })
    for (const dataset of datasets) {
        if (!dataset.isPrivate && !dataset.nonRedistributable)
            await syncDatasetToGitRepo(knex, dataset.id, { commitOnly: true })
    }
    await db.closeTypeOrmAndKnexConnections()
}

main()
