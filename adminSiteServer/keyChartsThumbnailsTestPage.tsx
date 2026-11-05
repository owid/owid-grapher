import { Router } from "express"
import * as R from "remeda"
import {
    GrapherState,
    makeLabelForGrapherTab,
    mapGrapherTabNameToQueryParam,
    GRAPHER_THUMBNAIL_WIDTH,
    GRAPHER_THUMBNAIL_HEIGHT,
} from "@ourworldindata/grapher"
import {
    DbRawChartConfig,
    GRAPHER_TAB_NAMES,
    GrapherInterface,
    type GrapherTabName,
} from "@ourworldindata/types"
import * as db from "../db/db.js"
import { getChartConfigBySlug } from "../db/model/Chart.js"
import { parseAndMigrateChartConfig } from "../db/model/ChartConfigs.js"
import { escapeJSONStringForInlineScript } from "@ourworldindata/utils"
import { renderToHtmlPage } from "../serverUtils/serverUtil.js"
import { getPlainRouteWithROTransaction } from "./plainRouterHelpers.js"
import { THUMBNAIL_STRATEGY_CHARTS } from "./thumbnailStrategyCharts.js"
import {
    prefixSvgIds,
    renderThumbnailWithStrategy,
} from "./thumbnailStrategyTestPage.js"

const CHARTS_PER_TOPIC = 4

/** Charts too atypical for their chart type to stand in for it */
const EXCLUDED_FROM_EVERY_CHART_TYPE = new Set([
    // A scatter plot with time on the x-axis
    "computation-used-to-train-notable-artificial-intelligence-systems",
])

const THUMBNAIL_CELL_WIDTH_PX = 160

interface TabsChart {
    slug: string
    title: string
    variantName?: string
    tabs: GrapherTabName[]
}

/** Response header with the chart's sources line */
const SOURCES_LINE_HEADER = "X-Sources-Line"

interface TopicCharts {
    topic: string
    charts: TabsChart[]
}

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

    router.get(
        "/key-charts-thumbnails/:slug.search-result.json",
        async (req, res) => {
            const params = new URLSearchParams({
                version: "1",
                variant: "medium",
                ignoreProjections: "",
                numDataTableRowsPerColumn: String(
                    req.query.hasScatter === "1"
                        ? SCATTER_SEARCH_TABLE_ROWS_PER_COLUMN
                        : SEARCH_TABLE_ROWS_PER_COLUMN
                ),
            })
            const response = await fetch(
                `${SEARCH_THUMBNAIL_BASE_URL}/${req.params.slug}.search-result.json?${params}`
            )
            res.status(response.status)
            res.setHeader("Content-Type", "application/json")
            res.send(await response.text())
        }
    )

    getPlainRouteWithROTransaction(
        router,
        "/key-charts-thumbnails/:slug.svg",
        async (req, res, trx) => {
            const tab = Object.values(GRAPHER_TAB_NAMES).find(
                (t) => t === req.query.tab
            )
            const { config } = await getChartConfigBySlug(trx, req.params.slug)
            // Keep the author's entities where the strategy doesn't apply
            const { svg, sourcesLine } =
                (await renderThumbnailWithStrategy({
                    config,
                    strategy: "evenPopulous",
                    tab,
                }).then((result) =>
                    result.svg === undefined ? undefined : result
                )) ??
                (await renderThumbnailWithStrategy({
                    config,
                    strategy: "author",
                    tab,
                }))
            if (svg === undefined) {
                res.status(204).end()
                return
            }
            if (sourcesLine)
                res.setHeader(
                    SOURCES_LINE_HEADER,
                    encodeURIComponent(sourcesLine)
                )
            res.setHeader("Content-Type", "image/svg+xml")
            res.send(
                prefixSvgIds(svg, `${req.params.slug}-${tab ?? "default"}`)
            )
        }
    )
}

async function findTopicCharts(
    trx: db.KnexReadonlyTransaction
): Promise<TopicCharts[]> {
    const slugs = R.unique(
        THUMBNAIL_STRATEGY_CHARTS.flatMap((t) => t.charts.map((c) => c.slug))
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
            THUMBNAIL_STRATEGY_CHARTS.flatMap((t) => t.charts),
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
        ...THUMBNAIL_STRATEGY_CHARTS.map((t) => ({
            topic: t.topic,
            charts: pickChartsWithVariedTabs(toTabsCharts(t.charts, configs), {
                maxCharts: CHARTS_PER_TOPIC,
                isDoneWhenNothingNew: false,
            }),
        })),
    ]
}

type RankedTabsChart = TabsChart & { viewsRank: number }

/** The candidates that have a config, most viewed first */
function toTabsCharts(
    candidates: (typeof THUMBNAIL_STRATEGY_CHARTS)[number]["charts"],
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

const SEARCH_THUMBNAIL_BASE_URL = "https://ourworldindata.org/grapher"

/** NUM_DATA_TABLE_ROWS_PER_COLUMN_IN_MEDIUM_VARIANT in site/search */
const SEARCH_TABLE_ROWS_PER_COLUMN = 4

/** SCATTER_NUM_DATA_TABLE_ROWS_PER_COLUMN_IN_MEDIUM_VARIANT in site/search */
const SCATTER_SEARCH_TABLE_ROWS_PER_COLUMN = 6

/** SCATTER_THUMBNAIL_WIDTH and SCATTER_THUMBNAIL_HEIGHT in site/search */
const SCATTER_SEARCH_THUMBNAIL_SIZE = { width: 300, height: 200 }

/** Tabs that search renders at a smaller font size, as in site/search */
const SEARCH_SMALL_FONT_TABS: GrapherTabName[] = [
    GRAPHER_TAB_NAMES.WorldMap,
    GRAPHER_TAB_NAMES.DiscreteBar,
    GRAPHER_TAB_NAMES.StackedDiscreteBar,
    GRAPHER_TAB_NAMES.Swimlane,
    GRAPHER_TAB_NAMES.Dumbbell,
]

const TAB_QUERY_PARAMS = Object.fromEntries(
    Object.values(GRAPHER_TAB_NAMES).map((tab) => [
        tab,
        mapGrapherTabNameToQueryParam(tab),
    ])
)

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
                        shown yet, with a thumbnail for each of a chart's tabs.
                    </p>
                </header>
                <div className="comparison-heads">
                    <span>Key-chart block thumbnails</span>
                    <span>Search</span>
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
                                    <p className="chart__source" />
                                    <div className="chart__comparison">
                                        <div className="chart__tabs">
                                            {chart.tabs.map((tab) => (
                                                <div
                                                    key={tab}
                                                    className="cell"
                                                    title={makeLabelForGrapherTab(
                                                        tab,
                                                        { format: "long" }
                                                    )}
                                                    data-src={`key-charts-thumbnails/${chart.slug}.svg?${new URLSearchParams({ tab })}`}
                                                />
                                            ))}
                                        </div>
                                        <div
                                            className={
                                                chart.tabs.includes(
                                                    GRAPHER_TAB_NAMES.ScatterPlot
                                                )
                                                    ? "search-result search-result--scatter"
                                                    : "search-result"
                                            }
                                            data-slug={chart.slug}
                                        />
                                    </div>
                                </section>
                            ))}
                        </section>
                    ))}
                </main>
                <script
                    dangerouslySetInnerHTML={{
                        __html: PAGE_SCRIPT,
                    }}
                />
            </body>
        </html>
    )
}

const PAGE_SCRIPT = `
const SEARCH_THUMBNAIL_BASE_URL = ${escapeJSONStringForInlineScript(JSON.stringify(SEARCH_THUMBNAIL_BASE_URL))}
const SEARCH_SMALL_FONT_TABS = new Set(${escapeJSONStringForInlineScript(JSON.stringify(SEARCH_SMALL_FONT_TABS))})
const TAB_QUERY_PARAMS = ${escapeJSONStringForInlineScript(JSON.stringify(TAB_QUERY_PARAMS))}
const SEARCH_TABLE_ROWS_PER_COLUMN = ${SEARCH_TABLE_ROWS_PER_COLUMN}
const SCATTER_SEARCH_TABLE_ROWS_PER_COLUMN = ${SCATTER_SEARCH_TABLE_ROWS_PER_COLUMN}
const SCATTER_SEARCH_THUMBNAIL_SIZE = ${escapeJSONStringForInlineScript(JSON.stringify(SCATTER_SEARCH_THUMBNAIL_SIZE))}
const SLOT_COLUMN_COUNTS = { "single-slot": 1, "double-slot": 2, "triple-slot": 3, "quad-slot": 4 }

// Mirrors constructPreviewUrlForTab in site/search for the medium variant
function makeSearchPreviewUrl(slug, data, slot, slotIndex, hasScatter) {
    const params = new URLSearchParams({
        ...data.grapherQueryParams,
        tab: TAB_QUERY_PARAMS[slot.grapherTab],
        ...(slot.previewParams ?? {}),
    })
    params.set("imType", "thumbnail")
    params.set("imMinimal", slotIndex === 0 ? "1" : "0")
    if (SEARCH_SMALL_FONT_TABS.has(slot.grapherTab)) params.set("imFontSize", "12")
    if (hasScatter) {
        params.set("imWidth", String(4 * SCATTER_SEARCH_THUMBNAIL_SIZE.width))
        params.set("imHeight", String(4 * SCATTER_SEARCH_THUMBNAIL_SIZE.height))
    }
    return SEARCH_THUMBNAIL_BASE_URL + "/" + slug + ".png?" + params
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag)
    if (className) element.className = className
    if (text !== undefined) element.textContent = text
    return element
}

function renderSearchTable(table, { columnCount, rowsPerColumn }) {
    const element = makeElement("div", "search-table")
    element.style.gridTemplateColumns = "repeat(" + columnCount + ", minmax(0, 1fr))"
    element.style.gridTemplateRows = "repeat(" + (rowsPerColumn + 1) + ", minmax(0, 1fr))"
    const rows = table.rows.slice(0, columnCount * rowsPerColumn)
    const times = new Set(rows.map((row) => row.time).filter(Boolean))
    const sharedTime = times.size === 1 ? [...times][0] : undefined
    const title = makeElement("div", "search-table__title",
        table.title + (sharedTime ? " in " + sharedTime : ""))
    title.style.gridColumn = "1 / -1"
    element.append(title)
    rows.forEach((row, rowIndex) => {
        const rowElement = makeElement("div", "search-table__row")
        rowElement.style.gridColumn = String(Math.floor(rowIndex / rowsPerColumn) + 1)
        rowElement.style.gridRow = String((rowIndex % rowsPerColumn) + 2)
        const swatch = makeElement("span", "search-table__swatch")
        swatch.style.background = row.color ?? "transparent"
        const label = makeElement("span", "search-table__label", row.label)
        const value = makeElement("span", "search-table__value",
            row.value + (row.time && !sharedTime ? " " + (row.timePreposition ?? "in") + " " + row.time : ""))
        rowElement.append(swatch, label, value)
        element.append(rowElement)
    })
    return element
}

async function renderSearchResult(container) {
    const slug = container.dataset.slug
    const hasScatter = container.classList.contains("search-result--scatter")
    const rowsPerColumn = hasScatter ? SCATTER_SEARCH_TABLE_ROWS_PER_COLUMN : SEARCH_TABLE_ROWS_PER_COLUMN
    try {
        const response = await fetch("key-charts-thumbnails/" + slug + ".search-result.json" + (hasScatter ? "?hasScatter=1" : ""))
        if (!response.ok) throw new Error("HTTP " + response.status)
        const data = await response.json()
        container.replaceChildren(...data.layout.map((slot, slotIndex) => {
            const slotElement = makeElement("div", "search-slot search-slot--" + slot.slotKey)
            slotElement.title = slot.grapherTab
            if (slot.grapherTab === "Table")
                slotElement.append(renderSearchTable(data.dataTable, {
                    columnCount: SLOT_COLUMN_COUNTS[slot.slotKey] ?? 1,
                    rowsPerColumn,
                }))
            else {
                const image = makeElement("img")
                image.alt = ""
                image.src = makeSearchPreviewUrl(slug, data, slot, slotIndex, hasScatter)
                slotElement.append(image)
            }
            return slotElement
        }))
    } catch (error) {
        container.textContent = "Failed: " + error
    }
}

const searchObserver = new IntersectionObserver((entries) => {
    for (const entry of entries) {
        if (!entry.isIntersecting) continue
        searchObserver.unobserve(entry.target)
        renderSearchResult(entry.target)
    }
}, { rootMargin: "400px" })
document.querySelectorAll(".search-result").forEach((container) => searchObserver.observe(container))

const MAX_CONCURRENT_RENDERS = 4
const MAX_ATTEMPTS = 4
const visibleCells = new Set()
const queue = []
let running = 0

function showSource(cell, response) {
    const sourcesLine = response.headers.get("${SOURCES_LINE_HEADER}")
    const source = cell.closest(".chart").querySelector(".chart__source")
    if (!sourcesLine || source.textContent) return
    const label = document.createElement("strong")
    label.textContent = "Source: "
    source.replaceChildren(label, decodeURIComponent(sourcesLine))
}

async function loadCell(cell) {
    for (let attempt = 1; ; attempt++) {
        try {
            const response = await fetch(cell.dataset.src)
            if (!response.ok) throw new Error("HTTP " + response.status)
            if (response.status === 204) cell.textContent = "Nothing to show"
            else cell.innerHTML = await response.text()
            showSource(cell, response)
            return
        } catch (error) {
            if (attempt >= MAX_ATTEMPTS) {
                cell.textContent = "Failed: " + error
                cell.classList.add("cell--failed")
                return
            }
            await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt))
        }
    }
}

function runQueue() {
    while (running < MAX_CONCURRENT_RENDERS && queue.length > 0) {
        const cell = queue.shift()
        // Skip cells scrolled out of view before their turn; they queue again when back
        if (!visibleCells.has(cell)) {
            delete cell.dataset.queued
            continue
        }
        observer.unobserve(cell)
        running++
        loadCell(cell).finally(() => {
            running--
            runQueue()
        })
    }
}

const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
        const cell = entry.target
        if (entry.isIntersecting) {
            visibleCells.add(cell)
            if (cell.dataset.queued === undefined) {
                cell.dataset.queued = ""
                queue.push(cell)
            }
        } else visibleCells.delete(cell)
    }
    runQueue()
}, { rootMargin: "200px" })
document.querySelectorAll(".cell").forEach((cell) => observer.observe(cell))
`

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
.chart__source { font-size: 12px; color: #577291; margin: 3px 0 0; min-height: 1.2em; }
.chart__source strong { font-weight: 700; }
.comparison-heads, .chart__comparison { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.comparison-heads { position: sticky; top: 0; z-index: 1; background: #fff; padding: 8px 24px; border-bottom: 1px solid #dbe5f0; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: #577291; }
.chart__tabs { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px; align-content: flex-start; }
.search-result { display: grid; grid-template-columns: repeat(8, ${THUMBNAIL_CELL_WIDTH_PX / 2}px); grid-auto-rows: ${(THUMBNAIL_CELL_WIDTH_PX / 2) * (GRAPHER_THUMBNAIL_HEIGHT / GRAPHER_THUMBNAIL_WIDTH)}px; gap: 0 10px; margin-top: 10px; padding-left: 24px; border-left: 1px solid #dbe5f0; font-size: 12px; color: #577291; }
.search-slot { box-sizing: border-box; border: 1px solid #c7d3e0; background: #fff; overflow: hidden; }
.search-slot img { width: 100%; height: 100%; object-fit: contain; display: block; }
.search-result--scatter { grid-auto-rows: ${(THUMBNAIL_CELL_WIDTH_PX / 2) * (SCATTER_SEARCH_THUMBNAIL_SIZE.height / SCATTER_SEARCH_THUMBNAIL_SIZE.width)}px; }
.search-slot--single-slot { grid-column: span 2; grid-row: span 2; }
.search-slot--double-slot { grid-column: span 4; grid-row: span 2; }
.search-slot--triple-slot { grid-column: span 6; grid-row: span 2; }
.search-slot--quad-slot { grid-column: span 8; grid-row: span 2; }
.search-slot--small-slot-left { grid-column: 7; grid-row: 2; }
.search-slot--small-slot-right { grid-column: 8; grid-row: 2; }
.search-table { display: grid; column-gap: 10px; height: 100%; padding: 4px 6px; box-sizing: border-box; font-size: 10px; color: #1d3d63; }
.search-table__title { font-weight: 700; color: #577291; align-self: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search-table__row { display: grid; grid-template-columns: 6px 1fr auto; gap: 4px; align-items: center; border-top: 1px solid #ebeef2; }
.search-table__swatch { width: 6px; height: 6px; border-radius: 50%; }
.search-table__label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search-table__value { white-space: nowrap; }
.cell { box-sizing: border-box; width: ${THUMBNAIL_CELL_WIDTH_PX}px; background: #fff; border: 1px solid #c7d3e0; aspect-ratio: ${GRAPHER_THUMBNAIL_WIDTH} / ${GRAPHER_THUMBNAIL_HEIGHT}; overflow: hidden; }
.cell svg { width: 100%; height: 100%; display: block; }
.cell--failed { color: #b13507; padding: 8px; font-size: 12px; }
`
