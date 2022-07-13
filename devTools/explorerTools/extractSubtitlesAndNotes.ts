import fs from "fs-extra"
import glob from "glob"

import { GIT_CMS_DIR } from "../../gitCms/GitCmsConstants.js"
import {
    ExplorerProgram,
    EXPLORER_FILE_SUFFIX,
} from "../../explorer/ExplorerProgram.js"
import { EXPLORERS_GIT_CMS_FOLDER } from "../../explorer/ExplorerConstants.js"

async function main(): Promise<void> {
    const allExplorerFilePaths = glob.sync(
        `${GIT_CMS_DIR}/${EXPLORERS_GIT_CMS_FOLDER}/*${EXPLORER_FILE_SUFFIX}`
    )

    const subtitles: string[] = []
    const notes: string[] = []

    for (const filePath of allExplorerFilePaths) {
        const tsv = fs.readFileSync(filePath, "utf8")
        const explorer = new ExplorerProgram(filePath, tsv)

        // skip non-published explorers
        if (!explorer.isPublished) continue

        const graphersTable = explorer.decisionMatrix.table
        subtitles.push(...graphersTable.get("subtitle").valuesAscending)
        notes.push(...graphersTable.get("note").valuesAscending)
    }

    fs.writeFileSync(
        "subtitlesAndNotes.json",
        JSON.stringify({ subtitles, notes })
    )
}

main()
