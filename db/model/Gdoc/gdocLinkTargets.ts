import * as _ from "lodash-es"
import {
    DbEnrichedMultiDimDataPage,
    MinimalExplorerInfo,
} from "@ourworldindata/types"
import * as db from "../../db.js"
import { mapSlugsToIds } from "../Chart.js"
import { getMultiDimDataPageBySlug } from "../MultiDimDataPage.js"
import {
    getMultiDimRedirectTargets,
    type MultiDimRedirectTarget,
} from "../MultiDimRedirects.js"

/**
 * What a `/grapher/<slug>` or `/explorers/<slug>` link in a gdoc points to.
 * Both the gdoc's linked charts and the preview images in the Google Doc
 * resolve links with this, so that they agree on what a link shows.
 */
export type GdocLinkTarget =
    | {
          type: "chart"
          chartId: number
          /**
           * Only set when drafts were requested. The article treats links to
           * draft charts as broken until they're published.
           */
          isDraft?: true
      }
    | {
          type: "multiDim"
          multiDim: DbEnrichedMultiDimDataPage
          /** Set when the link's slug redirects to the multi-dim */
          redirect?: MultiDimRedirectTarget
      }
    | { type: "explorer"; explorer: MinimalExplorerInfo }

export interface GdocLinkTargets {
    /** By the slug of `/grapher/<slug>` links */
    grapher: Map<string, GdocLinkTarget>
    /** By the slug of `/explorers/<slug>` links */
    explorer: Map<string, GdocLinkTarget>
}

async function getDraftChartIdsBySlug(
    knex: db.KnexReadonlyTransaction,
    slugs: string[]
): Promise<Map<string, number>> {
    if (slugs.length === 0) return new Map()
    const rows = await db.knexRaw<{ id: number; slug: string }>(
        knex,
        `-- sql
        SELECT c.id, cc.slug
        FROM charts c
        JOIN chart_configs cc ON cc.id = c.configId
        WHERE cc.slug IN (?)
            AND COALESCE(cc.config ->> '$.isPublished', 'false') != 'true'
        ORDER BY c.id DESC`,
        [slugs]
    )
    // Ordered by descending id, so the oldest draft with a slug wins
    return new Map(rows.map((row) => [row.slug, row.id]))
}

/**
 * Resolves link slugs the way the site does:
 *
 * - `/grapher/` links: an old chart slug that now redirects to a multi-dim
 *   goes there, then published charts by current or redirected slug, then
 *   multi-dims by slug.
 * - `/explorers/` links: an explorer that now redirects to a multi-dim goes
 *   there, then published explorers.
 *
 * With `includeDraftCharts`, `/grapher/` slugs that resolve to nothing else
 * fall back to a draft chart with that slug.
 *
 * Multi-dim redirects that depend on the source's query params resolve to one
 * representative target (see getMultiDimRedirectTargets).
 */
export async function resolveGdocLinkTargets(
    knex: db.KnexReadonlyTransaction,
    {
        grapherSlugs,
        explorerSlugs,
    }: { grapherSlugs: string[]; explorerSlugs: string[] },
    { includeDraftCharts = false }: { includeDraftCharts?: boolean } = {}
): Promise<GdocLinkTargets> {
    grapherSlugs = _.uniq(grapherSlugs)
    explorerSlugs = _.uniq(explorerSlugs)
    const targets: GdocLinkTargets = { grapher: new Map(), explorer: new Map() }
    if (grapherSlugs.length === 0 && explorerSlugs.length === 0) return targets

    const noExplorers: Record<string, MinimalExplorerInfo> = {}
    const [
        slugToIdMap,
        grapherMultiDimRedirects,
        explorerMultiDimRedirects,
        publishedExplorersBySlug,
    ] = await Promise.all([
        mapSlugsToIds(knex),
        getMultiDimRedirectTargets(knex, grapherSlugs, "/grapher/"),
        getMultiDimRedirectTargets(knex, explorerSlugs, "/explorers/"),
        explorerSlugs.length
            ? db.getPublishedExplorersBySlug(knex)
            : noExplorers,
    ])

    const multiDimsBySlug = new Map<
        string,
        Promise<DbEnrichedMultiDimDataPage | undefined>
    >()
    const getMultiDim = (
        slug: string
    ): Promise<DbEnrichedMultiDimDataPage | undefined> => {
        let multiDim = multiDimsBySlug.get(slug)
        if (!multiDim) {
            multiDim = getMultiDimDataPageBySlug(knex, slug, {
                onlyPublished: false,
            })
            multiDimsBySlug.set(slug, multiDim)
        }
        return multiDim
    }
    const resolveRedirect = async (
        redirect: MultiDimRedirectTarget
    ): Promise<GdocLinkTarget | undefined> => {
        const multiDim = await getMultiDim(redirect.targetSlug)
        return multiDim ? { type: "multiDim", multiDim, redirect } : undefined
    }

    const unresolvedGrapherSlugs: string[] = []
    await Promise.all(
        grapherSlugs.map(async (slug) => {
            const redirect = grapherMultiDimRedirects.get(slug)
            const chartId = slugToIdMap[slug]
            let target: GdocLinkTarget | undefined
            if (redirect) {
                target = await resolveRedirect(redirect)
            } else if (chartId) {
                target = { type: "chart", chartId }
            } else {
                const multiDim = await getMultiDim(slug)
                if (multiDim) target = { type: "multiDim", multiDim }
                else if (includeDraftCharts) unresolvedGrapherSlugs.push(slug)
            }
            if (target) targets.grapher.set(slug, target)
        })
    )
    for (const [slug, chartId] of await getDraftChartIdsBySlug(
        knex,
        unresolvedGrapherSlugs
    )) {
        targets.grapher.set(slug, { type: "chart", chartId, isDraft: true })
    }

    await Promise.all(
        explorerSlugs.map(async (slug) => {
            const redirect = explorerMultiDimRedirects.get(slug)
            const explorer = publishedExplorersBySlug[slug]
            let target: GdocLinkTarget | undefined
            if (redirect) target = await resolveRedirect(redirect)
            else if (explorer) target = { type: "explorer", explorer }
            if (target) targets.explorer.set(slug, target)
        })
    )

    return targets
}
