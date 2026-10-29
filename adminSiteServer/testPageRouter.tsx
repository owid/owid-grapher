// Testing pages for comparing local charts against live versions

import { Router } from "express"

import { renderToHtmlPage, expectInt } from "../serverUtils/serverUtil.js"
import { getChartConfigBySlug } from "../db/model/Chart.js"
import { parseAndMigrateChartConfig } from "../db/model/ChartConfigs.js"
import { Head } from "../site/Head.js"
import * as db from "../db/db.js"
import {
    ADMIN_BASE_URL,
    BAKED_GRAPHER_URL,
    BAKED_BASE_URL,
} from "../settings/serverSettings.js"
import {
    excludeUndefined,
    parseIntOrUndefined,
    Url,
    queryParamsToStr,
} from "@ourworldindata/utils"
import { grapherToSVG } from "../baker/GrapherImageBaker.js"
import {
    DbRawChartConfig,
    DbPlainChart,
    EntitySelectionMode,
    GRAPHER_TAB_CONFIG_OPTIONS,
    StackMode,
    GRAPHER_MAP_TYPE,
    GrapherTabConfigOption,
    GrapherChartOrMapType,
} from "@ourworldindata/types"
import { ExplorerAdminServer } from "../explorerAdminServer/ExplorerAdminServer.js"
import { ExplorerChartCreationMode } from "@ourworldindata/explorer"
import { getPlainRouteWithROTransaction } from "./plainRouterHelpers.js"
import { getAllPublishedMultiDimDataPages } from "../db/model/MultiDimDataPage.js"

import { GRAPHER_DYNAMIC_THUMBNAIL_URL } from "../settings/clientSettings.mjs"

const IS_LIVE = ADMIN_BASE_URL === "https://owid.cloud"
const DEFAULT_COMPARISON_URL = "https://ourworldindata.org"

const explorerAdminServer = new ExplorerAdminServer()

const testPageRouter = Router()

interface ChartItem {
    id: number
    slug: string
}

type QueryStringParam = string | string[] | undefined

function checkHasComparisonView(comparisonUrl: string): boolean {
    if (!comparisonUrl) return false
    if (IS_LIVE && comparisonUrl === DEFAULT_COMPARISON_URL) return false
    return true
}

function getSafeComparisonUrl(comparisonUrl: QueryStringParam): string {
    if (comparisonUrl === undefined) return DEFAULT_COMPARISON_URL
    if (typeof comparisonUrl !== "string") return ""
    if (!comparisonUrl.trim()) return ""

    try {
        const url = new URL(comparisonUrl)
        if (url.protocol === "http:" || url.protocol === "https:") {
            return Url.fromURL(comparisonUrl).originAndPath ?? ""
        }
    } catch {
        return ""
    }

    return ""
}

function getViewPropsFromQueryParams(
    params: Omit<EmbedTestPageQueryParams, "originalUrl">
): Pick<EmbedTestPageProps, "comparisonUrl" | "hasComparisonView"> {
    const comparisonUrl = getSafeComparisonUrl(params.comparisonUrl)
    const hasComparisonView = checkHasComparisonView(comparisonUrl)

    return { comparisonUrl, hasComparisonView }
}

function getChartCreationModeFromQueryParams(
    params: Pick<ExplorerTestPageQueryParams, "type">
): ExplorerChartCreationMode | undefined {
    switch (params.type) {
        case "grapher-ids":
            return ExplorerChartCreationMode.FromGrapherId
        case "csv-files":
            return ExplorerChartCreationMode.FromExplorerTableColumnSlugs
        case "indicators":
            return ExplorerChartCreationMode.FromVariableIds
        default:
            return undefined
    }
}

function parseStringArrayOrUndefined(param: string | undefined): string[] {
    if (param === undefined) return []
    return param.split(",")
}

function parseIntArrayOrUndefined(param: string | undefined): number[] {
    return excludeUndefined(
        parseStringArrayOrUndefined(param).map(parseIntOrUndefined)
    )
}

interface EmbedTestPageQueryParams {
    readonly originalUrl: string
    readonly comparisonUrl?: QueryStringParam
    readonly perPage?: string
    readonly page?: string
    readonly random?: string
    readonly tab?: GrapherTabConfigOption
    readonly type?: GrapherChartOrMapType
    readonly logLinear?: string
    readonly comparisonLines?: string
    readonly stackMode?: StackMode
    readonly relativeToggle?: string
    readonly chartTypeSwitcher?: string
    readonly categoricalLegend?: string
    readonly mixedTimeTypes?: string
    readonly faceted?: string
    readonly addCountryMode?: EntitySelectionMode
    readonly ids?: string
    readonly datasetIds?: string
    readonly namespace?: string
    readonly namespaces?: string
    readonly allColorSchemes?: string
}

interface ExplorerTestPageQueryParams {
    readonly originalUrl?: string
    readonly comparisonUrl?: QueryStringParam
    readonly type?: "grapher-ids" | "csv-files" | "indicators"
}

async function propsFromQueryParams(
    knex: db.KnexReadonlyTransaction,
    params: EmbedTestPageQueryParams
): Promise<EmbedTestPageProps> {
    const page = params.page
        ? expectInt(params.page)
        : params.random
          ? Math.floor(1 + Math.random() * 180) // Sample one of 180 pages. Some charts won't ever get picked but good enough.
          : 1
    const perPage = parseIntOrUndefined(params.perPage) ?? 20
    const ids = parseIntArrayOrUndefined(params.ids)
    const datasetIds = parseIntArrayOrUndefined(params.datasetIds)
    const namespaces =
        parseStringArrayOrUndefined(params.namespaces) ??
        (params.namespace ? [params.namespace] : [])

    let query = knex
        .table("charts")
        .join({ cc: "chart_configs" }, "charts.configId", "cc.id")
        .whereRaw("charts.publishedAt IS NOT NULL")
        .orderBy("charts.id", "DESC")
    console.error(query.toSQL())

    let tab = params.tab

    if (params.type) {
        if (params.type === GRAPHER_MAP_TYPE) {
            query = query.andWhereRaw(`cc.config->>"$.hasMapTab" = "true"`)
            tab ||= GRAPHER_TAB_CONFIG_OPTIONS.map
        } else {
            query = query.andWhereRaw(`cc.chartType = :type`, {
                type: params.type,
            })
            tab ||= GRAPHER_TAB_CONFIG_OPTIONS.chart
        }
    }

    if (params.logLinear) {
        query = query.andWhereRaw(
            `cc.config->>'$.yAxis.canChangeScaleType' = "true" OR cc.config->>'$.xAxis.canChangeScaleType'  = "true"`
        )
        tab = GRAPHER_TAB_CONFIG_OPTIONS.chart
    }

    if (params.comparisonLines) {
        query = query.andWhereRaw(
            `cc.config->'$.comparisonLines[0].yEquals' != ''`
        )
        tab = GRAPHER_TAB_CONFIG_OPTIONS.chart
    }

    if (params.stackMode) {
        query = query.andWhereRaw(`cc.config->'$.stackMode' = :stackMode`, {
            stackMode: params.stackMode,
        })
        tab = GRAPHER_TAB_CONFIG_OPTIONS.chart
    }

    if (params.relativeToggle) {
        query = query.andWhereRaw(
            `cc.config->>'$.hideRelativeToggle' = "false"`
        )
        tab = GRAPHER_TAB_CONFIG_OPTIONS.chart
    }

    if (params.chartTypeSwitcher) {
        query = query.andWhereRaw(
            `COALESCE(json_length(cc.config->'$.chartTypes'), 2) > 1`
        )
    }

    if (params.categoricalLegend) {
        // This is more of a heuristic, since this query can potentially include charts that don't
        // have a visible categorial legend, and can leave out some that have one.
        // But in practice it seems to work reasonably well.
        query = query.andWhereRaw(
            `json_length(cc.config->'$.map.colorScale.customCategoryColors') > 1`
        )
        tab = GRAPHER_TAB_CONFIG_OPTIONS.map
    }

    if (params.mixedTimeTypes) {
        query = query.andWhereRaw(
            `
            (
                SELECT COUNT(DISTINCT CASE
                    WHEN COALESCE(variables.display->>"$.timeInterval", "year") IN ("year", "decade")
                        THEN "year"
                    ELSE "day"
                END) as timeTypeCount
                FROM variables
                JOIN chart_dimensions ON chart_dimensions.variableId = variables.id
                WHERE chart_dimensions.chartId = charts.id
            ) >= 2
        `
        )
    }

    if (params.faceted) {
        query = query.andWhereRaw(
            `cc.config->>'$.selectedFacetStrategy' != 'none'`
        )
        tab = GRAPHER_TAB_CONFIG_OPTIONS.chart
    }

    if (params.addCountryMode) {
        const mode = params.addCountryMode
        if (mode === EntitySelectionMode.MultipleEntities) {
            query = query.andWhereRaw(
                `cc.config->'$.addCountryMode' IS NULL OR cc.config->'$.addCountryMode' = :mode`,
                {
                    mode: EntitySelectionMode.MultipleEntities,
                }
            )
        } else {
            query = query.andWhereRaw(`cc.config->'$.addCountryMode' = :mode`, {
                mode,
            })
        }
    }

    if (ids.length > 0) {
        query = query.andWhereRaw(`charts.id IN (${params.ids})`)
    }

    if (tab === GRAPHER_TAB_CONFIG_OPTIONS.map) {
        query = query.andWhereRaw(`cc.config->>"$.hasMapTab" = "true"`)
    } else if (tab === GRAPHER_TAB_CONFIG_OPTIONS.chart) {
        query = query.andWhereRaw(`cc.chartType IS NOT NULL`)
    }

    if (datasetIds.length > 0) {
        const datasetIds = params.datasetIds
        query = query.andWhereRaw(
            `
            EXISTS(
                SELECT *
                FROM variables
                INNER JOIN chart_dimensions ON chart_dimensions.variableId = variables.id
                WHERE variables.datasetId IN (:datasetIds)
                AND chart_dimensions.chartId = charts.id
            )
        `,
            { datasetIds }
        )
    }

    if (namespaces.length > 0) {
        query = query.andWhereRaw(
            `
            EXISTS(
                SELECT *
                FROM datasets
                INNER JOIN variables ON variables.datasetId = datasets.id
                INNER JOIN chart_dimensions ON chart_dimensions.variableId = variables.id
                WHERE datasets.namespace IN (:namespaces)
                AND chart_dimensions.chartId = charts.id
            )
        `,
            { namespaces: namespaces }
        )
    }

    const chartsQuery = query
        .clone()
        .select(knex.raw("charts.id, cc.slug"))
        .limit(perPage)
        .offset(perPage * (page - 1))

    const countQuery = query.clone().count({ count: "*" })

    console.error(chartsQuery.toSQL())

    const charts: ChartItem[] = (await chartsQuery).map((c) => ({
        id: c.id,
        slug: c.slug ?? "",
    }))

    if (tab) {
        charts.forEach((c) => (c.slug += `?tab=${tab}`))
    }

    const countRes = (await countQuery) as { count: number }[]
    const count = countRes[0]?.count
    const numPages = Math.ceil(count / perPage)

    const originalUrl = Url.fromURL(params.originalUrl)
    const prevPageUrl =
        page > 1
            ? originalUrl.updateQueryParams({ page: (page - 1).toString() })
                  .fullUrl
            : undefined
    const nextPageUrl =
        page < numPages
            ? originalUrl.updateQueryParams({ page: (page + 1).toString() })
                  .fullUrl
            : undefined

    const viewProps = getViewPropsFromQueryParams(params)

    return {
        ...viewProps,
        prevPageUrl: prevPageUrl,
        nextPageUrl: nextPageUrl,
        charts: charts,
        currentPage: page,
        totalPages: numPages,
    }
}

interface EmbedTestPageProps {
    prevPageUrl?: string
    nextPageUrl?: string
    currentPage?: number
    totalPages?: number
    charts: ChartItem[]
    comparisonUrl: string
    hasComparisonView: boolean
}

function EmbedTestPage(props: EmbedTestPageProps) {
    const style = `
        html, body {
            height: 100%;
            margin: 0;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        figure, iframe {
            border: 0;
            flex: 1;
            height: 575px;
            width: 100%;
            max-width: 815px;
            margin: 10px;
        }

        figure {
            padding-top: 3px;
        }

        .row {
            padding: 10px;
            margin: 0;
            border-bottom: 1px solid #ddd;
        }

        .side-by-side {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
        }

        h3 {
            width: 50%;
            text-align: center;
            margin: 0;
        }

        nav.pagination {
            width: 100%;
            text-align: center;
            padding: 15px;
        }

        .chart-id {
            font-size: 18px;
            font-weight: bold;
            padding-top: 10px;
            text-align: center;
        }

        .chart-id a {
            text-decoration: underline;
            text-decoration-color: #ccc;
        }
    `
    return (
        <html>
            <Head
                canonicalUrl=""
                pageTitle="Test Embeds"
                baseUrl={BAKED_BASE_URL}
            >
                <style dangerouslySetInnerHTML={{ __html: style }} />
            </Head>
            <body>
                <div className="row">
                    <div className="side-by-side">
                        {props.hasComparisonView && (
                            <h3>{props.comparisonUrl}</h3>
                        )}
                        <h3>{BAKED_BASE_URL}</h3>
                    </div>
                </div>
                {props.charts.map((chart) => (
                    <div key={chart.slug} className="row">
                        <div className="chart-id">
                            <a
                                href={queryParamsToStr({
                                    ids: chart.id.toString(),
                                    comparisonUrl: props.comparisonUrl,
                                })}
                            >
                                {chart.id}
                            </a>
                        </div>
                        <div className="side-by-side">
                            {props.hasComparisonView && (
                                <iframe
                                    src={`${props.comparisonUrl}/grapher/${chart.slug}`}
                                    loading="lazy"
                                />
                            )}
                            <iframe
                                src={`${BAKED_GRAPHER_URL}/${chart.slug}`}
                                loading="lazy"
                            />
                        </div>
                    </div>
                ))}
                <nav className="pagination">
                    {props.prevPageUrl && (
                        <a href={props.prevPageUrl}>&lt;&lt; Prev</a>
                    )}{" "}
                    {props.currentPage !== undefined &&
                        props.totalPages !== undefined &&
                        `Page ${props.currentPage} of ${props.totalPages}`}{" "}
                    {props.nextPageUrl && (
                        <a href={props.nextPageUrl}>Next &gt;&gt;</a>
                    )}
                </nav>
            </body>
        </html>
    )
}

getPlainRouteWithROTransaction(
    testPageRouter,
    "/embeds",
    async (req, res, trx) => {
        const props = await propsFromQueryParams(trx, {
            ...req.query,
            originalUrl: req.originalUrl,
        })
        res.send(renderToHtmlPage(<EmbedTestPage {...props} />))
    }
)

getPlainRouteWithROTransaction(
    testPageRouter,
    "/embeds/:id",
    async (req, res, trx) => {
        const id = req.params.id
        const chartRaw = await db.knexRawFirst<
            Pick<DbPlainChart, "id"> & { config: DbRawChartConfig["config"] }
        >(
            trx,
            `-- sql
                select ca.id, cc.config as config
                from charts ca
                join chart_configs cc
                on ca.configId = cc.id
                where ca.id = ?
            `,
            [id]
        )

        if (chartRaw) {
            const chartEnriched = {
                ...chartRaw,
                config: parseAndMigrateChartConfig(chartRaw.config),
            }
            const viewProps = getViewPropsFromQueryParams(req.query)
            const charts = [
                {
                    id: chartEnriched.id,
                    slug: `${chartEnriched.config.slug}${
                        req.query.tab ? `?tab=${req.query.tab}` : ""
                    }`,
                },
            ]
            res.send(
                renderToHtmlPage(
                    <EmbedTestPage
                        charts={charts}
                        comparisonUrl={DEFAULT_COMPARISON_URL}
                        hasComparisonView={viewProps.hasComparisonView}
                    />
                )
            )
        } else {
            res.send("Could not find chart ID")
        }
    }
)

function PreviewTestPage(props: {
    charts: { slug: DbRawChartConfig["slug"] }[]
}) {
    const style = `
        html, body {
            height: 100%;
            margin: 0;
        }

        img {
            width: 45%;
        }

        nav.pagination {
            width: 100%;
            text-align: center;
        }
    `
    return (
        <html>
            <head>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <title>Test Previews</title>
                <style dangerouslySetInnerHTML={{ __html: style }} />
            </head>
            <body>
                {props.charts.map((chart) => (
                    <div key={chart.slug} className="row">
                        <a
                            href={`https://ourworldindata.org/grapher/${chart.slug}`}
                        >
                            <img
                                src={`https://ourworldindata.org/grapher/${chart.slug}.svg`}
                            />
                        </a>
                        <a
                            href={`${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${chart.slug}.svg`}
                        >
                            <img
                                src={`${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${chart.slug}.svg`}
                            />
                        </a>
                    </div>
                ))}
            </body>
        </html>
    )
}

function EmbedVariantsTestPage(
    props: Omit<EmbedTestPageProps, "comparisonUrl">
) {
    const style = `
        html, body {
            height: 100%;
            margin: 0;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        figure, iframe {
            border: 0;
            flex: 1;
            height: 450px;
            margin: 10px;
        }

        .row {
            padding: 10px;
            margin: 0;
            border-bottom: 1px solid #ddd;
        }

        .side-by-side {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
        }

        h3 {
            width: 50%;
            text-align: center;
            margin: 0;
        }

        nav.pagination {
            width: 100%;
            text-align: center;
            padding: 15px;
        }

        .chart-id {
            font-size: 18px;
            font-weight: bold;
            padding-top: 10px;
            text-align: center;
        }
    `
    return (
        <html>
            <head>
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <title>Test Embed Variants</title>
                <style dangerouslySetInnerHTML={{ __html: style }} />
            </head>
            <body>
                {props.charts.map((chart) => (
                    <div key={chart.slug} className="row">
                        <div className="chart-id">{chart.id}</div>
                        <div className="side-by-side">
                            {props.hasComparisonView && (
                                <iframe
                                    src={`${BAKED_GRAPHER_URL}/${chart.slug}`}
                                    loading="lazy"
                                />
                            )}
                            <iframe
                                src={`${BAKED_GRAPHER_URL}/${chart.slug}`}
                                loading="lazy"
                            />
                        </div>
                    </div>
                ))}
                <nav className="pagination">
                    {props.prevPageUrl && (
                        <a href={props.prevPageUrl}>&lt;&lt; Prev</a>
                    )}{" "}
                    {props.currentPage !== undefined &&
                        props.totalPages !== undefined &&
                        `Page ${props.currentPage} of ${props.totalPages}`}{" "}
                    {props.nextPageUrl && (
                        <a href={props.nextPageUrl}>Next &gt;&gt;</a>
                    )}
                </nav>
            </body>
        </html>
    )
}

getPlainRouteWithROTransaction(
    testPageRouter,
    "/previews",
    async (req, res, trx) => {
        const charts = await db.knexRaw<{ slug: DbRawChartConfig["slug"] }>(
            trx,
            `-- sql
                SELECT cc.slug as slug
                FROM charts ca
                JOIN chart_configs cc
                ON ca.configId = cc.id
                LIMIT 200
            `
        )

        res.send(renderToHtmlPage(<PreviewTestPage charts={charts} />))
    }
)

getPlainRouteWithROTransaction(
    testPageRouter,
    "/embedVariants",
    async (req, res, trx) => {
        const charts = await db.knexRaw<ChartItem>(
            trx,
            `-- sql
                SELECT ca.id as id, cc.slug as slug
                FROM charts ca
                JOIN chart_configs cc
                ON ca.configId = cc.id
                WHERE ca.id=64
            `
        )
        const viewProps = getViewPropsFromQueryParams(req.query)

        res.send(
            renderToHtmlPage(
                <EmbedVariantsTestPage
                    charts={charts}
                    hasComparisonView={viewProps.hasComparisonView}
                />
            )
        )
    }
)

getPlainRouteWithROTransaction(
    testPageRouter,
    "/:slug.svg",
    async (req, res, trx) => {
        const grapher = await getChartConfigBySlug(trx, req.params.slug)
        const svg = await grapherToSVG(grapher.config)
        res.send(svg)
    }
)

getPlainRouteWithROTransaction(
    testPageRouter,
    "/explorers",
    async (req, res, trx) => {
        let explorers = await explorerAdminServer.getAllPublishedExplorers(trx)
        const viewProps = getViewPropsFromQueryParams(req.query)
        const chartCreationMode = getChartCreationModeFromQueryParams(req.query)

        if (chartCreationMode) {
            explorers = explorers.filter(
                (explorer) => explorer.chartCreationMode === chartCreationMode
            )
        }

        const slugs = explorers.map((explorer) => explorer.slug)

        res.send(
            renderToHtmlPage(<ExplorerTestPage slugs={slugs} {...viewProps} />)
        )
    }
)

interface ExplorerTestPageProps {
    slugs: string[]
    comparisonUrl?: string
    hasComparisonView?: boolean
}

function ExplorerTestPage(props: ExplorerTestPageProps) {
    const comparisonUrl = props.comparisonUrl ?? DEFAULT_COMPARISON_URL

    const style = `
        html, body {
            height: 100%;
            margin: 0;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        figure, iframe {
            border: 0;
            flex: 1;
            height: 700px;
            width: 100%;
            margin: 10px;
            max-width: 1200px;
        }

        .row {
            padding: 10px;
            margin: 0;
            border-bottom: 1px solid #ddd;
        }

        .side-by-side {
            display: flex;
            align-items: center;
            justify-content: space-around;
            width: 100%;
        }

        .side-by-side + .side-by-side {
            margin-top: 64px;
        }

        h3 {
            font-size: 18px;
            font-weight: bold;
        }

        .row > h3 {
          text-align: center;
        }
    `

    return (
        <html>
            <Head
                canonicalUrl=""
                pageTitle="Test Explorers"
                baseUrl={BAKED_BASE_URL}
            >
                <style dangerouslySetInnerHTML={{ __html: style }} />
            </Head>
            <body>
                <div className="row">
                    <div className="side-by-side">
                        {props.hasComparisonView && <h3>{comparisonUrl}</h3>}
                        <h3>{BAKED_BASE_URL}</h3>
                    </div>
                </div>
                {props.slugs.map((slug, index) => (
                    <div key={slug} className="row">
                        <h3>
                            {slug} ({index + 1}/{props.slugs.length})
                        </h3>
                        <div className="side-by-side">
                            {props.hasComparisonView && (
                                <iframe
                                    src={`${comparisonUrl}/explorers/${slug}`}
                                    loading="lazy"
                                />
                            )}
                            <iframe
                                src={`${BAKED_BASE_URL}/explorers/${slug}`}
                                loading="lazy"
                            />
                        </div>
                    </div>
                ))}
            </body>
        </html>
    )
}

getPlainRouteWithROTransaction(
    testPageRouter,
    "/multiDims",
    async (req, res, trx) => {
        const viewProps = getViewPropsFromQueryParams(req.query)
        const parseCount = (param: unknown): number | undefined =>
            typeof param === "string" ? parseIntOrUndefined(param) : undefined
        // `dimensions` filters to an exact number of dimensions,
        // `minDimensions` and `maxDimensions` to a range.
        const exact = parseCount(req.query.dimensions)
        const min = exact ?? parseCount(req.query.minDimensions)
        const max = exact ?? parseCount(req.query.maxDimensions)
        const isMobile = req.query.mobile === "true"

        const slugs = (await getAllPublishedMultiDimDataPages(trx))
            .filter(({ config }) => {
                const count = config.dimensions.length
                return (
                    (min === undefined || count >= min) &&
                    (max === undefined || count <= max)
                )
            })
            .map((multiDim) => multiDim.slug)
            .sort((a, b) => a.localeCompare(b))

        res.send(
            renderToHtmlPage(
                <MultiDimTestPage
                    slugs={slugs}
                    isMobile={isMobile}
                    {...viewProps}
                />
            )
        )
    }
)

interface MultiDimTestPageProps {
    slugs: string[]
    isMobile: boolean
    comparisonUrl: string
    hasComparisonView: boolean
}

function MultiDimTestPage(props: MultiDimTestPageProps) {
    const style = `
        html, body {
            height: 100%;
            margin: 0;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        iframe {
            border: 1px solid #ddd;
            flex: 1;
            height: 1000px;
            min-width: 0;
        }

        .row {
            padding: 10px;
            margin: 0;
            border-bottom: 1px solid #ddd;
        }

        .side-by-side {
            display: flex;
            gap: 16px;
            width: 100%;
        }

        .side-by-side > h3 {
            flex: 1;
            text-align: center;
            margin: 0;
        }

        .row > h3 {
            font-size: 18px;
            text-align: center;
        }

        /* Mobile mode: phone-sized frames (iPhone 14 viewport) */
        .mobile .side-by-side {
            justify-content: center;
        }

        .mobile iframe,
        .mobile .side-by-side > h3 {
            flex: 0 0 390px;
        }

        .mobile iframe {
            height: 844px;
        }

        .help {
            margin: 0;
            padding: 10px;
            font-size: 13px;
            color: #5b5b5b;
            border-bottom: 1px solid #ddd;
        }

        .help code {
            background: #f2f2f2;
            padding: 1px 4px;
            border-radius: 3px;
        }
    `

    return (
        <html>
            <Head
                canonicalUrl=""
                pageTitle="Test Multi-Dims"
                baseUrl={BAKED_BASE_URL}
            >
                <style dangerouslySetInnerHTML={{ __html: style }} />
            </Head>
            <body className={props.isMobile ? "mobile" : undefined}>
                <p className="help">
                    Every published multi-dim, live on the left and this server
                    on the right. Filter by number of dimensions with{" "}
                    <code>?dimensions=2</code> (exact),{" "}
                    <code>?minDimensions=3</code> and/or{" "}
                    <code>?maxDimensions=3</code>, view them at phone size with{" "}
                    <code>?mobile=true</code>, and compare against another
                    server with <code>?comparisonUrl=https://…</code>.
                </p>
                <div className="row">
                    <div className="side-by-side">
                        {props.hasComparisonView && (
                            <h3>{props.comparisonUrl}</h3>
                        )}
                        <h3>{BAKED_BASE_URL}</h3>
                    </div>
                </div>
                {props.slugs.map((slug, index) => (
                    <div key={slug} className="row">
                        <h3>
                            {slug} ({index + 1}/{props.slugs.length})
                        </h3>
                        <div className="side-by-side">
                            {props.hasComparisonView && (
                                <iframe
                                    src={`${props.comparisonUrl}/grapher/${slug}`}
                                    loading="lazy"
                                />
                            )}
                            <iframe
                                src={`${BAKED_GRAPHER_URL}/${slug}`}
                                loading="lazy"
                            />
                        </div>
                    </div>
                ))}
            </body>
        </html>
    )
}

// DEBUG ONLY: charts with annotations mocked in debugAnnotationOverrides.ts
interface AnnotatedChart {
    label: string
    path: string
}

const REAL_ANNOTATED_CHARTS: AnnotatedChart[] = [
    {
        label: "World: Great Leap Forward (point), COVID-19 (point)",
        path: "grapher/life-expectancy?time=1870..latest&country=~OWID_WRL",
    },
    {
        label: "Central African Republic: 2022 outlier (point)",
        path: "grapher/life-expectancy-unwpp?tab=line&country=~CAF",
    },
    {
        label: "Central African Republic: 2022 outlier, on a scatter plot",
        path: "grapher/food-supply-vs-life-expectancy",
    },
    {
        label: "Africa (FAO): jump from data coverage (point on two indicators)",
        path: "grapher/change-in-food-supply-population-and-agricultural-land-use?country=~Africa+%28FAO%29",
    },
    {
        label: "Forest in Scotland: pre-1600 data omitted (point, plus a legacy annotation)",
        path: "grapher/forest-area-as-share-of-land-area?tab=line&time=earliest..latest&country=~Scotland",
    },
    {
        label: "Chestnut production in Spain (range)",
        path: "explorers/global-food?tab=line&country=~ESP&Food=Chestnut&Metric=Production&Per+capita=false",
    },
    {
        label: "Obesity in France (range)",
        path: "grapher/share-of-adults-defined-as-obese?tab=line&country=GBR~FRA",
    },
    {
        label: "Chicken meat production in France (range)",
        path: "grapher/chicken-meat-production?tab=line&country=~FRA",
    },
    {
        label: "Maternal mortality in the US (range)",
        path: "grapher/maternal-mortality?tab=line&time=1962..latest",
    },
    {
        label: "GDP per capita in Tanzania (range)",
        path: "grapher/gdp-per-capita-penn-world-table?tab=line&country=~TZA",
    },
    {
        label: "CO₂ per capita in Sint Maarten (range)",
        path: "grapher/co-emissions-per-capita?country=OWID_WRL~USA~GBR~OWID_EU27~IND~CHN~ZAF~CAN~KEN~BEL~SXM",
    },
]

const MADE_UP_ANNOTATED_CHARTS: AnnotatedChart[] = [
    {
        label: "Life expectancy by continent",
        path: "grapher/life-expectancy",
    },
    {
        label: "Life expectancy in China",
        path: "grapher/life-expectancy?country=~CHN",
    },
    {
        label: "DTP3 immunization, long entity names",
        path: "grapher/share-of-children-immunized-dtp3?tab=line&country=Africa+%28WHO%29~Eastern+Mediterranean+%28WHO%29",
    },
    {
        label: "Foreign aid, legacy annotation and long entity names",
        path: "grapher/foreign-aid-given-net?tab=line&country=Non-DAC+countries~Global+Alliance+for+Vaccines+and+Immunization",
    },
    {
        label: "Monthly temperature anomalies, daily time axis",
        path: "grapher/monthly-temperature-anomalies?tab=line&country=~OWID_WRL",
    },
]

const SLOPE_ANNOTATED_CHARTS: AnnotatedChart[] = [
    {
        label: "Maternal mortality in the US (range)",
        path: "grapher/maternal-mortality?tab=slope",
    },
    {
        label: "Maternal mortality in the US, range after the period (no annotation)",
        path: "grapher/maternal-mortality?tab=slope&time=1985..2000",
    },
    {
        label: "CO₂ per capita in Sint Maarten (range)",
        path: "grapher/co-emissions-per-capita?tab=slope&country=OWID_WRL~USA~GBR~OWID_EU27~IND~CHN~ZAF~CAN~KEN~BEL~SXM",
    },
    {
        label: "Foreign aid, points on long entity names and a legacy annotation",
        path: "grapher/foreign-aid-given-net?tab=slope",
    },
    {
        label: "Africa (FAO): region popup and a point on two indicators",
        path: "grapher/change-in-food-supply-population-and-agricultural-land-use?tab=slope&country=~Africa+%28FAO%29",
    },
]

function AnnotationsTestPage() {
    const style = `
        body {
            margin: 0;
            font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
        }

        .row {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 10px;
            border-bottom: 1px solid #ddd;
        }

        h2 {
            text-align: center;
            margin: 30px 0 0;
        }

        h3 {
            margin: 10px 0 0;
        }

        iframe {
            border: 0;
            height: 575px;
            width: 100%;
            max-width: 815px;
            margin: 10px;
        }
    `
    return (
        <html>
            <Head
                canonicalUrl=""
                pageTitle="Test Annotations"
                baseUrl={BAKED_BASE_URL}
            >
                <style dangerouslySetInnerHTML={{ __html: style }} />
            </Head>
            <body>
                <h2>Real examples from Figma</h2>
                <AnnotatedChartList charts={REAL_ANNOTATED_CHARTS} />
                <h2>Made-up examples</h2>
                <AnnotatedChartList charts={MADE_UP_ANNOTATED_CHARTS} />
                <h2>Slope charts</h2>
                <AnnotatedChartList charts={SLOPE_ANNOTATED_CHARTS} />
            </body>
        </html>
    )
}

function AnnotatedChartList({ charts }: { charts: AnnotatedChart[] }) {
    return (
        <>
            {charts.map(({ label, path }) => (
                <div key={path} className="row">
                    <h3>
                        <a href={`${BAKED_BASE_URL}/${path}`}>{label}</a>
                    </h3>
                    <iframe src={`${BAKED_BASE_URL}/${path}`} loading="lazy" />
                </div>
            ))}
        </>
    )
}

testPageRouter.get("/annotations", (_req, res) => {
    res.send(renderToHtmlPage(<AnnotationsTestPage />))
})

export { getSafeComparisonUrl, testPageRouter }
