import {
    ExplorerProgram,
    ExplorersRouteResponse,
} from "@ourworldindata/explorer"
import { keyBy, sortBy } from "@ourworldindata/utils"
import { getExplorerBySlug, getAllExplorers } from "../db/model/Explorer"

import * as db from "../db/db.js"

export class ExplorerAdminServer {
    constructor() {
        this._cachedExplorers = null
        this._cacheTime = new Date(0)
    }

    private _cachedExplorers: null | Record<string, ExplorerProgram>
    private _cacheTime: Date

    async getAllExplorersCommand(knex: db.KnexReadonlyTransaction) {
        // Download all explorers for the admin index page
        try {
            const explorers = (await this.getAllExplorers(knex)).filter(
                (explorer) =>
                    ["monkeypox", "apox", "bpox"].includes(explorer.slug)
            )

            return {
                success: true,
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
