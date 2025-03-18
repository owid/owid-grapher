import {
    ExplorerProgram,
    EXPLORERS_GIT_CMS_FOLDER,
    ExplorersRouteResponse,
} from "@ourworldindata/explorer"
import { simpleGit, SimpleGit } from "simple-git"
import { keyBy, sortBy } from "@ourworldindata/utils"
import { getExplorerBySlug, getAllExplorers } from "../db/model/Explorer"

import * as db from "../db/db.js"

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

    async getAllExplorersCommand(knex: db.KnexReadonlyTransaction) {
        // Download all explorers for the admin index page
        try {
            const explorers = (await this.getAllExplorers(knex)).filter(
                (explorer) =>
                    ["monkeypox", "apox", "bpox"].includes(explorer.slug)
            )

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

    async getExplorerFromSlug(
        knex: db.KnexReadonlyTransaction,
        slug: string
    ): Promise<ExplorerProgram> {
        const exp = await getExplorerBySlug(knex, slug)
        if (!exp) throw new Error(`Explorer not found: ${slug}`)
        return new ExplorerProgram(slug, exp.tsv)
    }

    async getAllPublishedExplorers(knex: db.KnexReadonlyTransaction) {
        const explorers = await this.getAllExplorers(knex)
        const publishedExplorers = explorers.filter((exp) => exp.isPublished)
        return sortBy(publishedExplorers, (exp) => exp.explorerTitle)
    }

    async getAllPublishedExplorersBySlug(knex: db.KnexReadonlyTransaction) {
        return this.getAllPublishedExplorers(knex).then((publishedExplorers) =>
            keyBy(publishedExplorers, "slug")
        )
    }

    async getAllExplorers(
        knex: db.KnexReadonlyTransaction
    ): Promise<ExplorerProgram[]> {
        const explorerRows = await getAllExplorers(knex)

        return explorerRows.map(
            (row) =>
                new ExplorerProgram(
                    row.slug,
                    row.tsv ?? "",
                    JSON.parse(row.lastCommit)
                )
        )
    }

    // This operation takes ~5 seconds on prod, which is annoying for gdocs
    // where we update the page every 5 seconds, so I'm caching the result every 30 minutes
    // until we have Explorers in MySQL.
    // TODO: is this still necessary now that we fetch explorers from MySQL? how long does it take?
    async getAllPublishedExplorersBySlugCached(
        knex: db.KnexReadonlyTransaction
    ) {
        // Check if the cached value is available and fresh
        if (
            this._cachedExplorers !== null &&
            Date.now() - this._cacheTime.getTime() < 1000 * 60 * 30
        ) {
            return this._cachedExplorers
        }

        // Recalculate the value and cache it
        this._cachedExplorers = await this.getAllPublishedExplorersBySlug(knex)
        this._cacheTime = new Date()
        return this._cachedExplorers
    }
}
