import { ExplorerAdminServer } from "../../explorerAdminServer/ExplorerAdminServer.js"
import { GIT_CMS_DIR } from "../../gitCms/GitCmsConstants.js"
import fs from "fs-extra"
import path from "path"

// Useful to ensure that our explorer serialization and deserialization is idempotent,
// i.e. that there is no git diff (except for maybe whitespace) between the original
// and the saved version.
// Caution, this operates on your local owid-content directory.
const rewriteAllExplorers = async () => {
    const explorerServer = new ExplorerAdminServer(GIT_CMS_DIR)
    const allExplorers = await explorerServer.getAllExplorers()
    for (const explorer of allExplorers) {
        const fullPath = path.join(GIT_CMS_DIR, explorer.fullPath)
        console.log("Rewriting", fullPath)
        await fs.writeFile(fullPath, explorer.toString())
    }
    console.log("Finished rewriting", allExplorers.length, "explorers")
}

void rewriteAllExplorers()
