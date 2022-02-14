import fs from "fs-extra"
import {
    EXPLORER_FILE_SUFFIX,
    ExplorerProgram,
} from "../explorer/ExplorerProgram.js"
import {
    EXPLORERS_GIT_CMS_FOLDER,
    ExplorersRouteResponse,
} from "../explorer/ExplorerConstants.js"
import simpleGit, { SimpleGit } from "simple-git"
import { GitCommit } from "../clientUtils/owidTypes.js"

export class ExplorerAdminServer {
    constructor(gitDir: string) {
        this.gitDir = gitDir
    }

    private gitDir: string

    private _simpleGit?: SimpleGit
    private get simpleGit() {
        if (!this._simpleGit)
            this._simpleGit = simpleGit({
                baseDir: this.gitDir,
                binary: "git",
                maxConcurrentProcesses: 1,
            })
        return this._simpleGit
    }

    // we store explorers in a subdir of the gitcms for now. idea is we may store other things in there later.
    get absoluteFolderPath() {
        return this.gitDir + "/" + EXPLORERS_GIT_CMS_FOLDER + "/"
    }

    async getAllExplorersCommand() {
        // Download all explorers for the admin index page
        try {
            const explorers = await this.getAllExplorers()
            const branches = await this.simpleGit.branchLocal()
            const gitCmsBranchName = await branches.current
            const needsPull = false // todo: add

            return {
                success: true,
                gitCmsBranchName,
                needsPull,
                explorers: explorers.map((explorer) => explorer.toJson()),
            } as ExplorersRouteResponse
        } catch (err) {
            console.log(err)
            return {
                success: false,
                errorMessage: err,
            } as ExplorersRouteResponse
        }
    }

    // todo: make private? once we remove covid legacy stuff?
    async getExplorerFromFile(filename: string) {
        const fullPath = this.absoluteFolderPath + filename
        const content = await fs.readFile(fullPath, "utf8")
        const commits = await this.simpleGit.log({ file: fullPath, n: 1 })
        return new ExplorerProgram(
            filename.replace(EXPLORER_FILE_SUFFIX, ""),
            content,
            commits.latest as GitCommit
        )
    }

    async getExplorerFromSlug(slug: string) {
        return this.getExplorerFromFile(`${slug}${EXPLORER_FILE_SUFFIX}`)
    }

    async getAllPublishedExplorers() {
        const explorers = await this.getAllExplorers()
        return explorers.filter((exp) => exp.isPublished)
    }

    async getAllExplorers() {
        if (!fs.existsSync(this.absoluteFolderPath)) return []
        const files = await fs.readdir(this.absoluteFolderPath)
        const explorerFiles = files.filter((filename) =>
            filename.endsWith(EXPLORER_FILE_SUFFIX)
        )

        const explorers: ExplorerProgram[] = []
        for (const filename of explorerFiles) {
            const explorer = await this.getExplorerFromFile(filename)

            explorers.push(explorer)
        }
        return explorers
    }
}
