import crypto from "crypto"
import * as _ from "lodash-es"
import {
    LARGEST_IMAGE_WIDTH,
    QueryParams,
    Url,
    queryParamsToStr,
    searchParamsToMultiDimView,
    strToQueryParams,
} from "@ourworldindata/utils"
import {
    CLOUDFLARE_IMAGES_URL,
    GDOCS_CHART_PREVIEW_EXPLORER_URL,
    GDOCS_CHART_PREVIEW_GRAPHER_URL,
} from "../../../../settings/serverSettings.js"
import * as db from "../../../db.js"
import {
    type GdocLinkTarget,
    resolveGdocLinkTargets,
} from "../gdocLinkTargets.js"
import { type ChartPreviewComponentSpec } from "./chartPreviewBlocks.js"

/**
 * Maps chart components to the public PNG URL Google should fetch for their
 * preview image.
 *
 * The URL carries a version hash of everything that changes what the chart
 * looks like: its config and the data and metadata of the indicators it shows
 * (for explorers: the explorer config, its views and all their indicators).
 * Google keeps the URL an image was inserted from (as `sourceUri`), so an
 * image is up to date exactly when its `sourceUri` equals the URL we'd insert
 * now. The hash also busts the thumbnail cache on Cloudflare.
 */

export type ChartPreviewSource =
    | {
          status: "resolved"
          imageUrl: string
          /**
           * Width / height of the image, if it can have any shape (unlike our
           * chart renders, which all share one)
           */
          aspectRatio?: number
          /** Something the author should know about the image */
          message?: string
      }
    | { status: "unresolved"; message: string }

// Bump to re-render all preview images, e.g. after changing their size
const PREVIEW_FORMAT_VERSION = "1"

export function chartPreviewSpecKey(spec: ChartPreviewComponentSpec): string {
    return `${spec.type}:${spec.target}`
}

interface ChartConfigVersionInfo {
    configId: string
    configMd5: string
    variableIds: number[]
}

type VariableChecksums = Map<
    number,
    { dataChecksum: string | null; metadataChecksum: string | null }
>

function parseVariableIds(value: unknown): number[] {
    const parsed = typeof value === "string" ? JSON.parse(value) : value
    return Array.isArray(parsed)
        ? parsed.filter((id): id is number => typeof id === "number")
        : []
}

async function getVariableChecksums(
    knex: db.KnexReadonlyTransaction,
    variableIds: number[]
): Promise<VariableChecksums> {
    if (variableIds.length === 0) return new Map()
    const rows = await knex("variables")
        .select("id", "dataChecksum", "metadataChecksum")
        .whereIn("id", [...new Set(variableIds)])
    return new Map(rows.map((row) => [row.id, row]))
}

/** What a component renders, and what the image depends on */
type ResolvedTarget =
    | {
          status: "resolved"
          /** The PNG URL without query params */
          baseUrl: string
          queryStr: string
          /** Hashes of the configs involved */
          configHashes: string[]
          /** Indicators whose checksums go into the version */
          variableIds: number[]
          /** Something the author should know about the image */
          message?: string
      }
    | { status: "unresolved"; message: string }

type ResolvedGrapherTarget = Extract<ResolvedTarget, { status: "resolved" }>

function computeVersion(
    target: ResolvedGrapherTarget,
    checksums: VariableChecksums
): string {
    const variables = target.variableIds
        .toSorted((a, b) => a - b)
        .map((id) => {
            const checksum = checksums.get(id)
            return `${id}:${checksum?.dataChecksum}:${checksum?.metadataChecksum}`
        })
    return crypto
        .createHash("md5")
        .update(
            [PREVIEW_FORMAT_VERSION, ...target.configHashes, ...variables].join(
                "|"
            )
        )
        .digest("hex")
        .slice(0, 12)
}

function appendVersion(
    baseUrl: string,
    queryStr: string,
    version: string
): string {
    const separator = queryStr ? "&" : "?"
    return `${baseUrl}${queryStr}${separator}v=${version}`
}

/**
 * Grapher configs are rendered by id rather than slug, so that drafts render
 * too and a slug change doesn't break the preview.
 */
function makeGrapherTarget(
    info: ChartConfigVersionInfo,
    queryStr: string
): ResolvedTarget {
    return {
        status: "resolved",
        baseUrl: `${GDOCS_CHART_PREVIEW_GRAPHER_URL}/by-uuid/${info.configId}.png`,
        queryStr,
        configHashes: [info.configMd5],
        variableIds: info.variableIds,
    }
}

async function getChartConfigsById(
    knex: db.KnexReadonlyTransaction,
    ids: string[]
): Promise<Map<string, ChartConfigVersionInfo>> {
    if (ids.length === 0) return new Map()
    const rows = await db.knexRaw<{
        configId: string
        configMd5: string
        variableIds: unknown
    }>(
        knex,
        `-- sql
        SELECT
            id AS configId,
            configMd5,
            JSON_EXTRACT(config, '$.dimensions[*].variableId') AS variableIds
        FROM chart_configs
        WHERE id IN (?)`,
        [[...new Set(ids)]]
    )
    return new Map(
        rows.map((row) => [
            row.configId,
            {
                configId: row.configId,
                configMd5: row.configMd5,
                variableIds: parseVariableIds(row.variableIds),
            },
        ])
    )
}

async function getChartConfigsByChartId(
    knex: db.KnexReadonlyTransaction,
    chartIds: number[]
): Promise<Map<number, ChartConfigVersionInfo>> {
    if (chartIds.length === 0) return new Map()
    const rows = await db.knexRaw<{
        chartId: number
        configId: string
        configMd5: string
        variableIds: unknown
    }>(
        knex,
        `-- sql
        SELECT
            c.id AS chartId,
            cc.id AS configId,
            cc.configMd5,
            JSON_EXTRACT(cc.config, '$.dimensions[*].variableId') AS variableIds
        FROM charts c
        JOIN chart_configs cc ON cc.id = c.configId
        WHERE c.id IN (?)`,
        [[...new Set(chartIds)]]
    )
    return new Map(
        rows.map((row) => [
            row.chartId,
            {
                configId: row.configId,
                configMd5: row.configMd5,
                variableIds: parseVariableIds(row.variableIds),
            },
        ])
    )
}

interface GrapherLink {
    key: string
    slug: string
    queryParams: QueryParams
}

/**
 * Hashes of everything an explorer's render depends on: its config, the
 * grapher configs of all its views and the checksums of the indicators it
 * uses, aggregated in SQL since an explorer can have thousands of views. Data
 * loaded from CSV files isn't covered.
 */
async function getExplorerConfigHashes(
    knex: db.KnexReadonlyTransaction,
    slugs: string[]
): Promise<Map<string, string[]>> {
    if (slugs.length === 0) return new Map()
    const rows = await db.knexRaw<{
        slug: string
        configMd5: string
        viewsHash: string | null
        variablesHash: string | null
    }>(
        knex,
        `-- sql
        SELECT
            e.slug,
            MD5(e.config) AS configMd5,
            (
                SELECT BIT_XOR(CRC32(cc.configMd5))
                FROM explorer_views ev
                JOIN chart_configs cc ON cc.id = ev.chartConfigId
                WHERE ev.explorerSlug = e.slug
            ) AS viewsHash,
            (
                SELECT BIT_XOR(CRC32(CONCAT_WS(
                    ':', v.id, v.dataChecksum, v.metadataChecksum
                )))
                FROM variables v
                WHERE v.id IN (
                    SELECT variableId
                    FROM explorer_variables
                    WHERE explorerSlug = e.slug
                    UNION
                    SELECT cd.variableId
                    FROM explorer_charts ec
                    JOIN chart_dimensions cd ON cd.chartId = ec.chartId
                    WHERE ec.explorerSlug = e.slug
                )
            ) AS variablesHash
        FROM explorers e
        WHERE e.slug IN (?)`,
        [_.uniq(slugs)]
    )
    return new Map(
        rows.map((row) => [
            row.slug,
            [row.configMd5, String(row.viewsHash), String(row.variablesHash)],
        ])
    )
}

const DRAFT_CHART_MESSAGE =
    "Draft chart: the article shows this link as broken until the chart is published"

/**
 * Resolves /grapher/ and /explorers/ links like the article's own links do
 * (resolveGdocLinkTargets), but also renders draft charts so that authors can
 * see charts they're working on.
 *
 * - Charts render their grapher config, plus the link's query params.
 * - Multi-dims render the grapher config of the view the query params select.
 *   The dimension params only pick the view, so they're dropped from the image
 *   URL; the remaining ones (time, country, tab, ...) apply to the view.
 * - Explorers are rendered from their published page, which picks the view
 *   from the query params.
 */
async function resolveChartLinks(
    knex: db.KnexReadonlyTransaction,
    grapherLinks: GrapherLink[],
    explorerLinks: GrapherLink[]
): Promise<Map<string, ResolvedTarget>> {
    const targets = new Map<string, ResolvedTarget>()
    const linkTargets = await resolveGdocLinkTargets(
        knex,
        {
            grapherSlugs: grapherLinks.map((link) => link.slug),
            explorerSlugs: explorerLinks.map((link) => link.slug),
        },
        { includeDraftCharts: true }
    )

    const charts: { key: string; chartId: number; queryStr: string }[] = []
    const views: { key: string; viewConfigId: string; queryStr: string }[] = []
    const explorers: { key: string; slug: string; queryStr: string }[] = []
    const draftKeys = new Set<string>()

    const addTarget = (
        link: GrapherLink,
        target: GdocLinkTarget | undefined,
        missingMessage: string
    ): void => {
        if (!target) {
            targets.set(link.key, {
                status: "unresolved",
                message: missingMessage,
            })
            return
        }
        switch (target.type) {
            case "chart":
                if (target.isDraft) draftKeys.add(link.key)
                charts.push({
                    key: link.key,
                    chartId: target.chartId,
                    queryStr: queryParamsToStr(link.queryParams),
                })
                return
            case "explorer":
                explorers.push({
                    key: link.key,
                    slug: link.slug,
                    queryStr: queryParamsToStr(link.queryParams),
                })
                return
            case "multiDim": {
                const { config } = target.multiDim
                const queryParams = {
                    ...strToQueryParams(target.redirect?.queryStr ?? ""),
                    ...link.queryParams,
                }
                try {
                    const view = searchParamsToMultiDimView(
                        config,
                        new URLSearchParams(queryParamsToStr(queryParams))
                    )
                    const dimensionSlugs = config.dimensions.map((d) => d.slug)
                    views.push({
                        key: link.key,
                        viewConfigId: view.fullConfigId,
                        queryStr: queryParamsToStr(
                            _.omit(queryParams, dimensionSlugs)
                        ),
                    })
                } catch {
                    targets.set(link.key, {
                        status: "unresolved",
                        message: "No view of this multi-dim matches the link",
                    })
                }
                return
            }
        }
    }
    for (const link of grapherLinks)
        addTarget(
            link,
            linkTargets.grapher.get(link.slug),
            "No chart or multi-dim with this slug"
        )
    for (const link of explorerLinks)
        addTarget(
            link,
            linkTargets.explorer.get(link.slug),
            "No published explorer with this slug"
        )

    const [chartConfigs, viewConfigs, explorerHashes] = await Promise.all([
        getChartConfigsByChartId(
            knex,
            charts.map((chart) => chart.chartId)
        ),
        getChartConfigsById(
            knex,
            views.map((view) => view.viewConfigId)
        ),
        getExplorerConfigHashes(
            knex,
            explorers.map((explorer) => explorer.slug)
        ),
    ])
    for (const { key, chartId, queryStr } of charts) {
        const info = chartConfigs.get(chartId)
        targets.set(
            key,
            info
                ? {
                      ...makeGrapherTarget(info, queryStr),
                      ...(draftKeys.has(key)
                          ? { message: DRAFT_CHART_MESSAGE }
                          : {}),
                  }
                : { status: "unresolved", message: "Chart not found" }
        )
    }
    for (const { key, viewConfigId, queryStr } of views) {
        const info = viewConfigs.get(viewConfigId)
        targets.set(
            key,
            info
                ? makeGrapherTarget(info, queryStr)
                : { status: "unresolved", message: "Multi-dim view not found" }
        )
    }
    for (const { key, slug, queryStr } of explorers) {
        const configHashes = explorerHashes.get(slug)
        targets.set(
            key,
            configHashes
                ? {
                      status: "resolved",
                      baseUrl: `${GDOCS_CHART_PREVIEW_EXPLORER_URL}/${slug}.png`,
                      queryStr,
                      configHashes,
                      variableIds: [],
                  }
                : { status: "unresolved", message: "Explorer not found" }
        )
    }
    return targets
}

/** Narrative charts render their merged config, which is stored per chart */
async function resolveNarrativeCharts(
    knex: db.KnexReadonlyTransaction,
    names: { key: string; name: string }[]
): Promise<Map<string, ResolvedTarget>> {
    const targets = new Map<string, ResolvedTarget>()
    if (names.length === 0) return targets
    const rows: { name: string; chartConfigId: string }[] = await knex(
        "narrative_charts"
    )
        .select("name", "chartConfigId")
        .whereIn("name", _.uniq(names.map(({ name }) => name)))
    const configIdsByName = new Map(
        rows.map((row) => [row.name, row.chartConfigId])
    )
    const configs = await getChartConfigsById(knex, [
        ...configIdsByName.values(),
    ])
    for (const { key, name } of names) {
        const configId = configIdsByName.get(name)
        const info = configId ? configs.get(configId) : undefined
        targets.set(
            key,
            info
                ? makeGrapherTarget(info, "")
                : {
                      status: "unresolved",
                      message: "No narrative chart with this name",
                  }
        )
    }
    return targets
}

interface UploadedImage {
    cloudflareId: string | null
    originalWidth: number | null
    originalHeight: number | null
}

/**
 * Uploaded images are served from Cloudflare Images, which is shared by all
 * environments. Replacing an image uploads it under a new cloudflareId, so the
 * URL changes with every version and needs no version hash of its own.
 */
function makeUploadedImageSource(
    image: UploadedImage | undefined,
    missingMessage: string
): ChartPreviewSource {
    if (!image) return { status: "unresolved", message: missingMessage }
    if (!image.cloudflareId)
        return {
            status: "unresolved",
            message: "The image hasn't been uploaded to Cloudflare",
        }
    if (!CLOUDFLARE_IMAGES_URL)
        return {
            status: "unresolved",
            message: "CLOUDFLARE_IMAGES_URL isn't configured",
        }
    const { originalWidth, originalHeight } = image
    const width = Math.min(
        originalWidth ?? LARGEST_IMAGE_WIDTH,
        LARGEST_IMAGE_WIDTH
    )
    return {
        status: "resolved",
        imageUrl: `${CLOUDFLARE_IMAGES_URL}/${image.cloudflareId}/w=${width}`,
        aspectRatio:
            originalWidth && originalHeight
                ? originalWidth / originalHeight
                : undefined,
    }
}

/** `{.image}` by filename and `{.static-viz}` by name, each its current image */
async function resolveUploadedImages(
    knex: db.KnexReadonlyTransaction,
    images: { key: string; filename: string }[],
    staticVizs: { key: string; name: string }[]
): Promise<Map<string, ChartPreviewSource>> {
    const sources = new Map<string, ChartPreviewSource>()
    const [imageRows, staticVizRows]: [
        (UploadedImage & { filename: string })[],
        (UploadedImage & { name: string })[],
    ] = await Promise.all([
        images.length
            ? knex("images")
                  .select(
                      "filename",
                      "cloudflareId",
                      "originalWidth",
                      "originalHeight"
                  )
                  .whereIn("filename", _.uniq(images.map((i) => i.filename)))
                  .whereNull("replacedBy")
            : [],
        staticVizs.length
            ? knex("static_viz as sv")
                  .join("images as i", "i.id", "sv.imageId")
                  .select(
                      "sv.name",
                      "i.cloudflareId",
                      "i.originalWidth",
                      "i.originalHeight"
                  )
                  .whereIn("sv.name", _.uniq(staticVizs.map((v) => v.name)))
            : [],
    ])
    const imagesByFilename = new Map(
        imageRows.map((row) => [row.filename, row])
    )
    const staticVizByName = new Map(staticVizRows.map((row) => [row.name, row]))
    for (const { key, filename } of images) {
        sources.set(
            key,
            makeUploadedImageSource(
                imagesByFilename.get(filename),
                "No uploaded image with this filename"
            )
        )
    }
    for (const { key, name } of staticVizs) {
        sources.set(
            key,
            makeUploadedImageSource(
                staticVizByName.get(name),
                "No static viz with this name"
            )
        )
    }
    return sources
}

export async function resolveChartPreviewSources(
    knex: db.KnexReadonlyTransaction,
    specs: ChartPreviewComponentSpec[]
): Promise<Map<string, ChartPreviewSource>> {
    const sources = new Map<string, ChartPreviewSource>()
    const grapherLinks: GrapherLink[] = []
    const explorerLinks: GrapherLink[] = []
    const narrativeChartNames: { key: string; name: string }[] = []
    const imageFilenames: { key: string; filename: string }[] = []
    const staticVizNames: { key: string; name: string }[] = []
    const seen = new Set<string>()

    for (const spec of specs) {
        const key = chartPreviewSpecKey(spec)
        if (seen.has(key)) continue
        seen.add(key)
        if (spec.type === "narrative-chart") {
            narrativeChartNames.push({ key, name: spec.target })
            continue
        }
        if (spec.type === "image") {
            imageFilenames.push({ key, filename: spec.target })
            continue
        }
        if (spec.type === "static-viz") {
            staticVizNames.push({ key, name: spec.target })
            continue
        }
        const url = Url.fromURL(spec.target)
        const link = { key, slug: url.slug ?? "", queryParams: url.queryParams }
        if (url.isGrapher && url.slug) {
            grapherLinks.push(link)
        } else if (url.isExplorer && url.slug) {
            explorerLinks.push(link)
        } else {
            sources.set(key, {
                status: "unresolved",
                message: "Not a link to a chart or explorer",
            })
        }
    }

    const targets = new Map([
        ...(await resolveChartLinks(knex, grapherLinks, explorerLinks)),
        ...(await resolveNarrativeCharts(knex, narrativeChartNames)),
    ])

    const checksums = await getVariableChecksums(
        knex,
        [...targets.values()].flatMap((target) =>
            target.status === "resolved" ? target.variableIds : []
        )
    )
    for (const [key, target] of targets) {
        sources.set(
            key,
            target.status === "resolved"
                ? {
                      status: "resolved",
                      imageUrl: appendVersion(
                          target.baseUrl,
                          target.queryStr,
                          computeVersion(target, checksums)
                      ),
                      message: target.message,
                  }
                : target
        )
    }

    for (const [key, source] of await resolveUploadedImages(
        knex,
        imageFilenames,
        staticVizNames
    )) {
        sources.set(key, source)
    }

    return sources
}
