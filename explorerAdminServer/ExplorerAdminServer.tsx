import { existsSync, readdir, readFile } from "fs-extra"
import {
    EXPLORER_FILE_SUFFIX,
    ExplorerProgram,
} from "../explorer/ExplorerProgram.js"
import {
    EXPLORERS_GIT_CMS_FOLDER,
    ExplorersRouteResponse,
} from "../explorer/ExplorerConstants.js"
import { simpleGit, SimpleGit } from "simple-git"
import { GitCommit, keyBy } from "@ourworldindata/utils"
import { Dictionary } from "lodash"

export class ExplorerAdminServer {
    constructor(gitDir: string) {
        this.gitDir = gitDir
        this._cachedExplorers = null
        this._cacheTime = new Date(0)
    }

    private gitDir: string
    private _cachedExplorers: null | Dictionary<ExplorerProgram>
    private _cacheTime: Date

    private _simpleGit?: SimpleGit
    private get simpleGit() {
        if (!this._simpleGit)
            this._simpleGit = simpleGit({
                baseDir: this.gitDir,
                binary: "git",
                maxConcurrentProcesses: 16, // we're getting one "git log" per explorer file, so concurrency makes a massive difference
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
        const content = await readFile(fullPath, "utf8")
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

    async getAllPublishedExplorersBySlug() {
        return this.getAllPublishedExplorers().then((publishedExplorers) =>
            keyBy(publishedExplorers, "slug")
        )
    }

    async getAllExplorers(): Promise<ExplorerProgram[]> {
        if (!existsSync(this.absoluteFolderPath)) return []
        const files = await readdir(this.absoluteFolderPath)
        const explorerFiles = files.filter((filename) =>
            filename.endsWith(EXPLORER_FILE_SUFFIX)
        )

        return Promise.all(
            explorerFiles.map((filename) => this.getExplorerFromFile(filename))
        )
    }

    async getAllPublishedExplorersBySlugCached() {
        // Check if the cached value is available and fresh
        if (
            this._cachedExplorers !== null &&
            Date.now() - this._cacheTime.getTime() < 1000 * 60 * 30
        ) {
            return this._cachedExplorers
        }

        // Recalculate the value and cache it
        this._cachedExplorers = await this.getAllPublishedExplorersBySlug()
        this._cacheTime = new Date()
        return this._cachedExplorers
    }
}
