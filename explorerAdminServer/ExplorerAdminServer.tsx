import fs from "fs-extra"
import {
    EXPLORER_FILE_SUFFIX,
    ExplorerProgram,
} from "../explorer/ExplorerProgram.js"
import {
    EXPLORERS_GIT_CMS_FOLDER,
    ExplorersRouteResponse,
} from "../explorer/ExplorerConstants.js"
import * as db from "../db/db.js"
import { simpleGit, SimpleGit } from "simple-git"
import {
    DbPlainExplorer,
    GitCommit,
    keyBy,
    sortBy,
} from "@ourworldindata/utils"
import { uniq } from "lodash"

export class ExplorerAdminServer {
    constructor(gitDir: string) {
        this.gitDir = gitDir
        this._cachedExplorers = null
        this._cacheTime = new Date(0)
    }

    private gitDir: string
    private _cachedExplorers: null | Record<string, ExplorerProgram>
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

    async getExplorerFromSlug(knex: db.KnexReadonlyTransaction, slug: string) {
        const explorerConfig = await db.knexRawFirst<
            Pick<DbPlainExplorer, "config">
        >(knex, `SELECT config FROM explorers WHERE slug = ?`, [slug])
        if (!explorerConfig) {
            throw new Error(`Explorer not found: ${slug}`)
        }
        const config = JSON.parse(explorerConfig.config)
        const entries = Object.entries(config)
        const out: string[][] = []
        for (const [key, value] of entries) {
            if (key === "blocks" || key === "_version") continue
            if (typeof value === "string") {
                out.push([key, value])
            } else if (Array.isArray(value)) {
                out.push([key, ...value])
            }
        }
        for (const block of config.blocks) {
            out.push([block.type, ...block.args])
            if (block.block) {
                const columns = uniq(
                    block.block.flatMap((row: Record<string, string>) =>
                        Object.keys(row)
                    )
                ) as string[]
                out.push(["", ...columns])
                for (const row of block.block) {
                    out.push(["", ...columns.map((col) => row[col])])
                }
            }
        }
        return new ExplorerProgram(slug, config)
    }

    async getAllPublishedExplorers() {
        const explorers = await this.getAllExplorers()
        const publishedExplorers = explorers.filter((exp) => exp.isPublished)
        return sortBy(publishedExplorers, (exp) => exp.explorerTitle)
    }

    async getAllPublishedExplorersBySlug() {
        return this.getAllPublishedExplorers().then((publishedExplorers) =>
            keyBy(publishedExplorers, "slug")
        )
    }

    async getAllExplorers(): Promise<ExplorerProgram[]> {
        if (!fs.existsSync(this.absoluteFolderPath)) return []
        const files = await fs.readdir(this.absoluteFolderPath)
        const explorerFiles = files.filter((filename) =>
            filename.endsWith(EXPLORER_FILE_SUFFIX)
        )

        return Promise.all(
            explorerFiles.map((filename) => this.getExplorerFromFile(filename))
        )
    }

    // This operation takes ~5 seconds on prod, which is annoying for gdocs
    // where we update the page every 5 seconds, so I'm caching the result every 30 minutes
    // until we have Explorers in MySQL.
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
