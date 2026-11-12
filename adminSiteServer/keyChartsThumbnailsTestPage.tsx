import { Router } from "express"
import * as R from "remeda"
import {
    GrapherState,
    makeLabelForGrapherTab,
    serializeImageRequest,
    type ImageRequest,
} from "@ourworldindata/grapher"
import {
    ChartLabelMode,
    DbRawChartConfig,
    GRAPHER_TAB_NAMES,
    GrapherInterface,
    type GrapherQueryParams,
    GrapherVariant,
    type GrapherTabName,
} from "@ourworldindata/types"
import { queryParamsToStr } from "@ourworldindata/utils"
import * as db from "../db/db.js"
import { parseAndMigrateChartConfig } from "../db/model/ChartConfigs.js"
import { renderToHtmlPage } from "../serverUtils/serverUtil.js"
import { GRAPHER_DYNAMIC_THUMBNAIL_URL } from "../settings/clientSettings.mjs"
import { toAllChartsGrapherParams } from "../site/blocks/allChartsGrapherParams.js"
import { toGrapherQueryParams } from "../site/search/searchUtils.js"
import { getPlainRouteWithROTransaction } from "./plainRouterHelpers.js"
import { KEY_CHARTS_BY_TOPIC } from "./keyChartsByTopic.js"

const CHARTS_PER_TOPIC = 4

/** Mirrors `ALL_CHARTS_THUMBNAIL_REQUEST` in site/blocks/AllChartsRow.tsx */
const ALL_CHARTS_THUMBNAIL_REQUEST: ImageRequest = {
    variant: GrapherVariant.Thumbnail,
    labelMode: ChartLabelMode.Names,
    size: { kind: "explicit", fontSize: 18 },
    includeDetails: false,
}

/** Charts too atypical for their chart type to stand in for it */
const EXCLUDED_FROM_EVERY_CHART_TYPE = new Set([
    // A scatter plot with time on the x-axis
    "computation-used-to-train-notable-artificial-intelligence-systems",
])

/** $all-charts-row-thumbnail-width and -height in AllChartsRow.scss */
const THUMBNAIL_WIDTH_PX = 158
const THUMBNAIL_HEIGHT_PX = 84

interface TabsChart {
    slug: string
    title: string
    variantName?: string
    tabs: GrapherTabName[]
}

interface TopicCharts {
    topic: string
    charts: TabsChart[]
}

type KeyChartCandidate = (typeof KEY_CHARTS_BY_TOPIC)[number]["charts"][number]

type RankedTabsChart = TabsChart & { viewsRank: number }

let topicChartsCache: TopicCharts[] | undefined

export function addKeyChartsThumbnailsRoutes(router: Router): void {
    getPlainRouteWithROTransaction(
        router,
        "/key-charts-thumbnails",
        async (_req, res, trx) => {
            topicChartsCache ??= await findTopicCharts(trx)
            res.send(
                renderToHtmlPage(
                    <KeyChartsThumbnailsTestPage topics={topicChartsCache} />
                )
            )
        }
    )
}

async function findTopicCharts(
    trx: db.KnexReadonlyTransaction
): Promise<TopicCharts[]> {
    const slugs = R.unique(
        KEY_CHARTS_BY_TOPIC.flatMap((t) => t.charts.map((c) => c.slug))
    )
    const rows = await db.knexRaw<Pick<DbRawChartConfig, "slug" | "config">>(
        trx,
        `-- sql
            SELECT cc.slug, cc.config
            FROM charts c
            JOIN chart_configs cc ON c.configId = cc.id
            WHERE cc.slug IN (?)`,
        [slugs]
    )
    const configs = new Map(
        rows.map((row) => [row.slug, parseAndMigrateChartConfig(row.config)])
    )
    const allCharts = toTabsCharts(
        R.uniqueBy(
            KEY_CHARTS_BY_TOPIC.flatMap((t) => t.charts),
            (c) => c.slug
        ),
        configs
    )
    return [
        {
            topic: "Every chart type",
            charts: pickChartsWithVariedTabs(
                allCharts.filter(
                    (chart) => !EXCLUDED_FROM_EVERY_CHART_TYPE.has(chart.slug)
                ),
                {
                    maxCharts: Infinity,
                    isDoneWhenNothingNew: true,
                    firstSlug: "co-emissions-per-capita",
                }
            ),
        },
        ...KEY_CHARTS_BY_TOPIC.map((t) => ({
            topic: t.topic,
            charts: pickChartsWithVariedTabs(toTabsCharts(t.charts, configs), {
                maxCharts: CHARTS_PER_TOPIC,
                isDoneWhenNothingNew: false,
            }),
        })),
    ]
}

/** The candidates that have a config, most viewed first */
function toTabsCharts(
    candidates: KeyChartCandidate[],
    configs: Map<string | null, GrapherInterface>
): RankedTabsChart[] {
    return R.sortBy(candidates, (c) => c.viewsRank).flatMap((candidate) => {
        const config = configs.get(candidate.slug)
        if (!config) return []
        const grapherState = new GrapherState(config)
        return [
            {
                slug: candidate.slug,
                title: config.title ?? candidate.slug,
                variantName: config.variantName,
                tabs: grapherState.availableTabs.filter(
                    (tab) => tab !== GRAPHER_TAB_NAMES.Table
                ),
                viewsRank: candidate.viewsRank,
            },
        ]
    })
}

/**
 * The given or most viewed chart, then the charts that add the most tabs not
 * shown yet, most viewed first among equals
 */
function pickChartsWithVariedTabs(
    charts: RankedTabsChart[],
    {
        maxCharts,
        isDoneWhenNothingNew,
        firstSlug,
    }: {
        maxCharts: number
        isDoneWhenNothingNew: boolean
        firstSlug?: string
    }
): TabsChart[] {
    const picked: TabsChart[] = []
    const shownTabs = new Set<GrapherTabName>()
    const countNewTabs = (chart: TabsChart): number =>
        chart.tabs.filter((tab) => !shownTabs.has(tab)).length
    let rest = charts
    while (picked.length < maxCharts && rest.length > 0) {
        const next =
            picked.length === 0
                ? (rest.find((chart) => chart.slug === firstSlug) ?? rest[0])
                : R.firstBy(
                      rest,
                      [countNewTabs, "desc"],
                      [(chart) => chart.viewsRank, "asc"]
                  )!
        if (isDoneWhenNothingNew && countNewTabs(next) === 0) break
        picked.push(next)
        next.tabs.forEach((tab) => shownTabs.add(tab))
        rest = rest.filter((chart) => chart !== next)
    }
    return picked
}

type MakeGrapherParams = (tab: GrapherTabName) => GrapherQueryParams

/** The all-charts block's grapher params when no country is picked */
const makeAllChartsGrapherParams: MakeGrapherParams = (tab) =>
    toAllChartsGrapherParams({ tab, countries: [] })

/** Only the tab, so the author's selection shows */
const makeTabOnlyGrapherParams: MakeGrapherParams = (tab) =>
    toGrapherQueryParams({ tab })

/** A thumbnail URL as AllChartsRow builds it for a chart hit, uncached */
function makeThumbnailUrl(
    slug: string,
    tab: GrapherTabName,
    makeGrapherParams: MakeGrapherParams
): string {
    const grapherQueryStr = queryParamsToStr(makeGrapherParams(tab)).replace(
        /^\?/,
        ""
    )
    const imageQueryStr = serializeImageRequest(
        ALL_CHARTS_THUMBNAIL_REQUEST
    ).toString()
    const queryStr = [grapherQueryStr, imageQueryStr, "nocache"]
        .filter((part) => part)
        .join("&")
    return `${GRAPHER_DYNAMIC_THUMBNAIL_URL}/${slug}.png?${queryStr}`
}

function KeyChartsThumbnailsTestPage({
    topics,
}: {
    topics: TopicCharts[]
}): React.ReactElement {
    return (
        <html>
            <head>
                <meta charSet="utf-8" />
                <title>Key-charts block thumbnails</title>
                <link
                    href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&family=Playfair+Display:wght@600&display=swap"
                    rel="stylesheet"
                />
                <style>{PAGE_CSS}</style>
            </head>
            <body>
                <header>
                    <h1>Key-charts block thumbnails</h1>
                    <p className="note">
                        Per topic, the most viewed chart and{" "}
                        {CHARTS_PER_TOPIC - 1} more that add the most tabs not
                        shown yet, with the all-charts block's thumbnail for
                        each of a chart's tabs, from{" "}
                        <code>{GRAPHER_DYNAMIC_THUMBNAIL_URL}</code>. On the
                        right, the same request with only the tab, which shows
                        the author's selection.
                    </p>
                </header>
                <div className="comparison-heads">
                    <span>All-charts block</span>
                    <span>Author's selection</span>
                </div>
                <main>
                    {topics.map(({ topic, charts }) => (
                        <section key={topic} className="topic">
                            <h2 className="topic__title">{topic}</h2>
                            {charts.map((chart) => (
                                <section key={chart.slug} className="chart">
                                    <h3 className="chart__title">
                                        <a
                                            href={`https://ourworldindata.org/grapher/${chart.slug}`}
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            {chart.title}
                                        </a>
                                        {chart.variantName && (
                                            <span className="chart__variant">
                                                {" "}
                                                {chart.variantName}
                                            </span>
                                        )}
                                    </h3>
                                    <div className="chart__comparison">
                                        <ThumbnailRow
                                            chart={chart}
                                            makeGrapherParams={
                                                makeAllChartsGrapherParams
                                            }
                                        />
                                        <ThumbnailRow
                                            chart={chart}
                                            makeGrapherParams={
                                                makeTabOnlyGrapherParams
                                            }
                                        />
                                    </div>
                                </section>
                            ))}
                        </section>
                    ))}
                </main>
            </body>
        </html>
    )
}

function ThumbnailRow({
    chart,
    makeGrapherParams,
}: {
    chart: TabsChart
    makeGrapherParams: MakeGrapherParams
}): React.ReactElement {
    return (
        <div className="chart__tabs">
            {chart.tabs.map((tab) => {
                const url = makeThumbnailUrl(chart.slug, tab, makeGrapherParams)
                return (
                    <a
                        key={tab}
                        className="cell"
                        href={url}
                        target="_blank"
                        rel="noopener"
                        title={makeLabelForGrapherTab(tab, { format: "long" })}
                    >
                        <img src={url} loading="lazy" alt="" />
                    </a>
                )
            })}
        </div>
    )
}

const PAGE_CSS = `
body { margin: 0; font-family: Lato, sans-serif; background: #fff; color: #1d3d63; }
header { padding: 16px 24px; border-bottom: 1px solid #dbe5f0; }
header h1 { font-family: "Playfair Display", serif; font-weight: 600; font-size: 20px; margin: 0 0 4px; }
.note { font-size: 13px; color: #577291; margin: 0; max-width: 900px; }
main { padding: 0 24px 24px; }
.topic__title { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #577291; margin: 24px 0 0; }
.chart { padding: 14px 0; border-bottom: 1px solid #dbe5f0; }
.chart__title { font-family: "Playfair Display", serif; font-weight: 600; font-size: 16px; line-height: 1.25; margin: 0; }
.chart__title a { color: #002147; text-decoration: none; }
.chart__title a:hover { text-decoration: underline; }
.chart__variant { font-family: Lato, sans-serif; font-weight: 400; font-size: 12px; color: #577291; }
.comparison-heads, .chart__comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.comparison-heads { position: sticky; top: 0; z-index: 1; background: #fff; padding: 8px 24px; border-bottom: 1px solid #dbe5f0; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #577291; }
.chart__tabs { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; align-content: flex-start; }
.chart__tabs + .chart__tabs { padding-left: 24px; border-left: 1px solid #dbe5f0; }
.cell { display: block; background: #fff; border: 1px solid #c7d3e0; }
.cell:hover { border-color: #577291; }
.cell img { display: block; width: ${THUMBNAIL_WIDTH_PX}px; height: ${THUMBNAIL_HEIGHT_PX}px; object-fit: contain; }
`
