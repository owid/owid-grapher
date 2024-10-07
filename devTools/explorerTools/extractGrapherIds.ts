import fs from "fs-extra"
import { glob } from "glob"
import path from "path"

import { GIT_CMS_DIR } from "../../gitCms/GitCmsConstants.js"
import {
    EXPLORERS_GIT_CMS_FOLDER,
    ExplorerProgram,
    EXPLORER_FILE_SUFFIX,
} from "@ourworldindata/explorer"

async function main(): Promise<void> {
    const allExplorerFilePaths = glob.sync(
        `${GIT_CMS_DIR}/${EXPLORERS_GIT_CMS_FOLDER}/*${EXPLORER_FILE_SUFFIX}`
    )

    const csvRows: string[] = []
    csvRows.push("explorerSlug,isPublished,grapherId")

    for (const filePath of allExplorerFilePaths) {
        const tsv = fs.readFileSync(filePath, "utf8")
        const explorer = new ExplorerProgram(filePath, tsv)

        const explorerSlug = path.basename(filePath, EXPLORER_FILE_SUFFIX)

        const graphersTable = explorer.decisionMatrix.table
        const grapherIdCol = graphersTable.get("grapherId")

        for (const grapherId of grapherIdCol.values)
            csvRows.push(
                [explorerSlug, explorer.isPublished, grapherId].join(",")
            )
    }

    console.log(csvRows.join("\n"))
}

main()
