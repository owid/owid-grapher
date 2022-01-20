import { mkdirp, writeFile } from "fs-extra"
import path from "path"
import { ExplorerProgram } from "../explorer/ExplorerProgram"
import { explorerUrlMigrationsById } from "../explorer/urlMigrations/ExplorerUrlMigrations"
import { explorerRedirectTable } from "../explorerAdminServer/ExplorerRedirects"

const bakeAllPublishedExplorers = async (outputFolder: string) => {
    const published = await this.getAllPublishedExplorers()
    await this.bakeExplorersToDir(outputFolder, published)
}

const bakeExplorersToDir = async (
    directory: string,
    explorers: ExplorerProgram[] = []
) => {
    for (const explorer of explorers) {
        await this.write(
            `${directory}/${explorer.slug}.html`,
            await this.renderExplorerPage(explorer)
        )
    }
}

const bakeAllExplorerRedirects = async (outputFolder: string) => {
    const explorers = await this.getAllExplorers()
    const redirects = explorerRedirectTable.rows
    for (const redirect of redirects) {
        const { migrationId, path: redirectPath, baseQueryStr } = redirect
        const transform = explorerUrlMigrationsById[migrationId]
        if (!transform) {
            throw new Error(
                `No explorer URL migration with id '${migrationId}'. Fix the list of explorer redirects and retry.`
            )
        }
        const { explorerSlug } = transform
        const program = explorers.find(
            (program) => program.slug === explorerSlug
        )
        if (!program) {
            throw new Error(
                `No explorer with slug '${explorerSlug}'. Fix the list of explorer redirects and retry.`
            )
        }
        const html = await this.renderExplorerPage(program, {
            explorerUrlMigrationId: migrationId,
            baseQueryStr,
        })
        await this.write(path.join(outputFolder, `${redirectPath}.html`), html)
    }
}

const write = async (outPath: string, content: string) => {
    await mkdirp(path.dirname(outPath))
    await writeFile(outPath, content)
    console.log(outPath)
}
