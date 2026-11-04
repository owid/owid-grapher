import { Router } from "express"
import * as R from "remeda"
import { runInAction } from "mobx"
import ReactDOMServer from "react-dom/server"
import {
    Grapher,
    GrapherState,
    LineChartState,
    LineChartThumbnail,
    fetchInputTableForConfig,
    loadCatalogData,
    GRAPHER_THUMBNAIL_WIDTH,
    GRAPHER_THUMBNAIL_HEIGHT,
} from "@ourworldindata/grapher"
import {
    AxisMinMaxValueStr,
    DumbbellValueLabelMode,
    EntityName,
    EntitySelectionMode,
    FacetStrategy,
    GrapherInterface,
    GrapherVariant,
    GRAPHER_TAB_NAMES,
    type GrapherTabName,
    SeriesStrategy,
} from "@ourworldindata/types"
import { Bounds, escapeJSONStringForInlineScript } from "@ourworldindata/utils"
import { getChartConfigBySlug } from "../db/model/Chart.js"
import { renderToHtmlPage } from "../serverUtils/serverUtil.js"
import { getPlainRouteWithROTransaction } from "./plainRouterHelpers.js"
import { CATALOG_URL, DATA_API_URL } from "../settings/serverSettings.js"
import { THUMBNAIL_STRATEGY_CHARTS } from "./thumbnailStrategyCharts.js"
import { ThumbnailMetrics, measureThumbnail } from "./thumbnailMetrics.js"
import {
    LATEST_VALUE_COVERAGE,
    MAX_LATEST_VALUE_WINDOW_YEARS,
    STRATEGIES,
    StrategyId,
    findSlopeStartTime,
    pickEntities,
} from "./thumbnailEntityStrategies.js"

const READER_COUNTRIES: EntityName[] = [
    "Germany",
    "Kenya",
    "India",
    "United States",
    "Brazil",
    "Nigeria",
    "China",
    "United Kingdom",
]

/** Width of a thumbnail cell, about the size of one in the all-charts block on desktop */
const THUMBNAIL_CELL_WIDTH_PX = 160

/** Space between the lines and the top and bottom of a line thumbnail */
const LINE_PLOT_PADDING_PX = 14

/** Base font size for thumbnails */
const THUMBNAIL_FONT_SIZE = 18

/** Extra space before the set-apart columns */
const SET_APART_GAP_PX = 32

const FIRST_SET_APART_INDEX = STRATEGIES.findIndex((s) => s.isSetApart)

const GRID_STYLE: React.CSSProperties = {
    gridTemplateColumns: [
        "180px",
        ...STRATEGIES.map(
            (_s, i) =>
                `${THUMBNAIL_CELL_WIDTH_PX + (i === FIRST_SET_APART_INDEX ? SET_APART_GAP_PX : 0)}px`
        ),
    ].join(" "),
}

/** Chart types in the list, grouped by chart family */
const CHART_TYPE_GROUPS: { label: string; chartTypes: string[] }[] = [
    {
        label: "Change over time",
        chartTypes: [
            "Line chart",
            "Slope chart",
            "Stacked area",
            "Stacked bar",
        ],
    },
    {
        label: "Comparison across entities",
        chartTypes: [
            "Discrete bar",
            "Stacked discrete bar",
            "Dumbbell",
            "Marimekko",
        ],
    },
    { label: "Relationship", chartTypes: ["Scatter plot"] },
    { label: "Geography", chartTypes: ["Map"] },
]

const CHART_TYPES: string[] = CHART_TYPE_GROUPS.flatMap((g) => g.chartTypes)

const ENTITY_BUDGET: Partial<Record<string, number>> = {
    [GRAPHER_TAB_NAMES.LineChart]: 4,
    [GRAPHER_TAB_NAMES.SlopeChart]: 4,
    [GRAPHER_TAB_NAMES.DiscreteBar]: 6,
    [GRAPHER_TAB_NAMES.StackedDiscreteBar]: 6,
    [GRAPHER_TAB_NAMES.Dumbbell]: 6,
}

export function addThumbnailStrategyRoutes(router: Router): void {
    router.get("/thumbnail-strategies", (req, res) => {
        const topic =
            req.query.topic === "all"
                ? undefined
                : (THUMBNAIL_STRATEGY_CHARTS[Number(req.query.topic)]?.topic ??
                  THUMBNAIL_STRATEGY_CHARTS[0].topic)
        const chartType = CHART_TYPES.find((t) => t === req.query.type)
        const readerCountry =
            READER_COUNTRIES.find((c) => c === req.query.country) ??
            READER_COUNTRIES[0]
        res.send(
            renderToHtmlPage(
                <ThumbnailStrategyTestPage
                    topic={topic}
                    chartType={chartType}
                    readerCountry={readerCountry}
                />
            )
        )
    })

    getPlainRouteWithROTransaction(
        router,
        "/thumbnail-strategies/:slug.svg",
        async (req, res, trx) => {
            const strategy = STRATEGIES.find((s) => s.id === req.query.strategy)
            if (!strategy) {
                res.status(400).send("Unknown strategy")
                return
            }
            const { config } = await getChartConfigBySlug(trx, req.params.slug)
            const readerCountry = READER_COUNTRIES.find(
                (c) => c === req.query.country
            )
            const { svg, canPickEntities, metrics } =
                await renderThumbnailWithStrategy({
                    config,
                    strategy: strategy.id,
                    readerCountry,
                })
            res.setHeader(CAN_PICK_ENTITIES_HEADER, String(canPickEntities))
            if (metrics) res.setHeader(METRICS_HEADER, JSON.stringify(metrics))
            if (svg === undefined) {
                res.status(204).end()
                return
            }
            res.setHeader("Content-Type", "image/svg+xml")
            res.send(prefixSvgIds(svg, `${req.params.slug}-${strategy.id}`))
        }
    )
}

function ThumbnailStrategyTestPage({
    topic,
    chartType,
    readerCountry,
}: {
    topic?: string
    chartType?: string
    readerCountry: EntityName
}): React.ReactElement {
    const charts = findCharts({ topic, chartType })
    return (
        <html>
            <head>
                <meta charSet="utf-8" />
                <title>Thumbnail entity strategies</title>
                <link
                    href="https://fonts.googleapis.com/css2?family=Lato:wght@400;500;700&display=swap"
                    rel="stylesheet"
                />
                <style>{PAGE_CSS}</style>
            </head>
            <body>
                <header>
                    <h1>Thumbnail entity strategies</h1>
                    <p className="note">
                        Per topic, the 5 most viewed charts and 5 more that add
                        other chart types, maps and configurations. Every column
                        picks entities a different way, from the countries with
                        a recent enough value. How recent is the indicator's own
                        tolerance if it sets one, otherwise the shortest window
                        before the chart's end that includes{" "}
                        {LATEST_VALUE_COVERAGE * 100}% of the countries with
                        data in the chart, at most{" "}
                        {MAX_LATEST_VALUE_WINDOW_YEARS} years. The second
                        caption line shows the window. Budget: 4 lines or
                        slopes, 6 bars or dumbbell rows. Charts where picking
                        doesn't apply (maps, scatter plots, stacked areas,
                        faceted charts, charts that plot several indicators or
                        one entity at a time) show only the first column. On
                        line charts, a pick whose past values would make the
                        y-axis more than twice as tall as its latest value
                        would, such as Kuwait's 1991 spike in CO₂ per capita, is
                        swapped for a similar country without one, except in the
                        columns that keep their picks as they are (As
                        configured, trimmed; Continents; dataRange today).
                    </p>
                    <form method="get">
                        <label>
                            Topic{" "}
                            <select
                                name="topic"
                                defaultValue={
                                    topic === undefined
                                        ? "all"
                                        : THUMBNAIL_STRATEGY_CHARTS.findIndex(
                                              (t) => t.topic === topic
                                          )
                                }
                            >
                                <option value="all">All topics</option>
                                {THUMBNAIL_STRATEGY_CHARTS.map((t, i) => (
                                    <option key={t.topic} value={i}>
                                        {t.topic}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Chart type{" "}
                            <select name="type" defaultValue={chartType ?? ""}>
                                <option value="">All chart types</option>
                                {CHART_TYPE_GROUPS.map((group) => (
                                    <optgroup
                                        key={group.label}
                                        label={group.label}
                                    >
                                        {group.chartTypes.map((t) => (
                                            <option key={t} value={t}>
                                                {t}
                                            </option>
                                        ))}
                                    </optgroup>
                                ))}
                            </select>
                        </label>
                        <label>
                            Reader's country{" "}
                            <select name="country" defaultValue={readerCountry}>
                                {READER_COUNTRIES.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <span className="count">{charts.length} charts</span>
                    </form>
                    <div className="grid" style={GRID_STYLE}>
                        <div />
                        {STRATEGIES.map((s, i) => (
                            <div
                                key={s.id}
                                className={
                                    i === FIRST_SET_APART_INDEX
                                        ? "column-head column-head--set-apart"
                                        : "column-head"
                                }
                            >
                                <strong>{s.name}</strong>
                                <small>{s.description}</small>
                            </div>
                        ))}
                    </div>
                </header>
                <section className="summary">
                    <h2>Scores over the rows loaded so far</h2>
                    <p className="note">
                        Each thumbnail gets three scores from 0 to 1. Legibility
                        (L) is for line and bar charts. For lines it averages
                        the share of lines that keep their label, the share of
                        the plot's height their ends span, and how close labels
                        stay to their lines. For bars it averages the labels'
                        size (unreadable at half their normal size, as they
                        shrink to fit many bars) and the share that fit on one
                        line. Representativeness (R) averages how much of the
                        countries' rank and value range the picks cover and how
                        close every country is to a pick. Familiarity (F) is the
                        picks' median population on a log scale, from 1 million
                        (0) to 1 billion (1). The score is the mean of those
                        that apply. The best score in a row among the columns
                        before the gap counts as a win; set-apart columns are
                        scored but can't win.
                    </p>
                    <table id="summary" />
                </section>
                <main className="grid" style={GRID_STYLE}>
                    {charts.map((chart) => (
                        <ChartRow
                            key={chart.slug}
                            slug={chart.slug}
                            description={chart.description}
                            readerCountry={readerCountry}
                        />
                    ))}
                </main>
                <script dangerouslySetInnerHTML={{ __html: PAGE_SCRIPT }} />
            </body>
        </html>
    )
}

/**
 * Listed charts in the topic and of the chart type, each slug once. Across
 * topics they're sorted by views, most viewed first.
 */
function findCharts({
    topic,
    chartType,
}: {
    topic?: string
    chartType?: string
}): (typeof THUMBNAIL_STRATEGY_CHARTS)[number]["charts"] {
    const charts = THUMBNAIL_STRATEGY_CHARTS.filter(
        (t) => topic === undefined || t.topic === topic
    ).flatMap((t) => t.charts)
    const matches = R.uniqueBy(
        charts.filter(
            (c) => chartType === undefined || c.chartType === chartType
        ),
        (c) => c.slug
    )
    return topic === undefined ? R.sortBy(matches, (c) => c.viewsRank) : matches
}

function ChartRow({
    slug,
    description,
    readerCountry,
}: {
    slug: string
    description: string
    readerCountry: EntityName
}): React.ReactElement {
    return (
        <>
            <div className="row-label">
                <a
                    href={`https://ourworldindata.org/grapher/${slug}`}
                    target="_blank"
                    rel="noopener"
                >
                    {slug}
                </a>
                <small>{description}</small>
            </div>
            {STRATEGIES.map((s, i) => (
                <div
                    key={s.id}
                    className={
                        i === FIRST_SET_APART_INDEX
                            ? "slot slot--set-apart"
                            : "slot"
                    }
                >
                    <div
                        className="cell"
                        data-src={`thumbnail-strategies/${slug}.svg?${new URLSearchParams(
                            s.id === "readerCountry"
                                ? { strategy: s.id, country: readerCountry }
                                : { strategy: s.id }
                        )}`}
                        data-row={slug}
                        data-strategy={s.id}
                        data-is-first-in-row={i === 0 ? "" : undefined}
                    />
                    <div className="metrics" />
                </div>
            ))}
        </>
    )
}

/** A chart's thumbnail, without an SVG if the strategy doesn't apply to it */
export async function renderThumbnailWithStrategy({
    config,
    strategy,
    readerCountry,
    tab,
}: {
    config: GrapherInterface
    strategy: StrategyId
    readerCountry?: EntityName
    /** The tab to render instead of the chart's default */
    tab?: GrapherTabName
}): Promise<{
    svg?: string
    canPickEntities: boolean
    metrics?: ThumbnailMetrics
    sourcesLine?: string
}> {
    const bounds = new Bounds(
        0,
        0,
        GRAPHER_THUMBNAIL_WIDTH,
        GRAPHER_THUMBNAIL_HEIGHT
    )
    const grapherState = new GrapherState({
        ...config,
        bounds,
        staticBounds: bounds,
        baseFontSize: THUMBNAIL_FONT_SIZE,
        variant: GrapherVariant.Thumbnail,
        additionalDataLoaderFn: (key) =>
            loadCatalogData(key, { baseUrl: CATALOG_URL }),
    })
    runInAction(() => {
        grapherState.isExportingToSvgOrPng = true
        grapherState.shouldIncludeDetailsInStaticExport = false
        grapherState.useNameLabelsOnly = true
        grapherState.hideNoDataLabel = true
        grapherState.hideSeriesLabels = false
    })
    const inputTable = await fetchInputTableForConfig({
        dimensions: grapherState.dimensionConfigs,
        selectedEntityColors: grapherState.selectedEntityColors,
        dataApiUrl: DATA_API_URL,
    })
    if (inputTable) grapherState.inputTable = inputTable
    if (tab !== undefined && tab !== grapherState.activeTab) {
        const defaultTab = grapherState.activeTab
        runInAction(() => {
            grapherState.setTab(tab)
            grapherState.onTabChange(defaultTab, tab)
        })
    }
    if (grapherState.activeTab === GRAPHER_TAB_NAMES.Table)
        grapherState.resetToDefaultTab()
    if (
        grapherState.activeTab === GRAPHER_TAB_NAMES.WorldMap ||
        grapherState.activeTab === GRAPHER_TAB_NAMES.DiscreteBar
    )
        runInAction(() => (grapherState.hideLegend = true))
    if (grapherState.activeTab === GRAPHER_TAB_NAMES.Dumbbell)
        runInAction(() => {
            grapherState.dumbbell.valueLabelMode = DumbbellValueLabelMode.None
            grapherState.hideLegend = true
            grapherState.yAxis.hideAxis = true
        })
    if (grapherState.activeTab === GRAPHER_TAB_NAMES.StackedDiscreteBar)
        runInAction(() => {
            grapherState.hideTotalValueLabel = true
            grapherState.yAxis.hideAxis = true
        })
    if (
        grapherState.activeTab === GRAPHER_TAB_NAMES.StackedArea ||
        grapherState.activeTab === GRAPHER_TAB_NAMES.StackedBar
    )
        runInAction(() => (grapherState.xAxis.hideAxis = true))
    if (grapherState.activeTab === GRAPHER_TAB_NAMES.LineChart)
        runInAction(() => {
            grapherState.xAxis.hideAxis = true
            grapherState.verticalPlotPadding = LINE_PLOT_PADDING_PX
            grapherState.yAxis.updateFromObject({
                min: AxisMinMaxValueStr.auto,
                max: AxisMinMaxValueStr.auto,
            })
        })
    if (grapherState.activeTab === GRAPHER_TAB_NAMES.ScatterPlot) {
        runInAction(() => {
            for (const axis of [grapherState.xAxis, grapherState.yAxis]) {
                axis.hideGridlines = true
                axis.hideTickLabels = true
            }
        })
    }
    if (
        grapherState.activeTab === GRAPHER_TAB_NAMES.SlopeChart &&
        config.minTime === undefined
    )
        moveSlopeStart(grapherState)
    removeFacets(grapherState)

    const budget = findEntityBudget(grapherState)
    if (budget !== undefined && strategy !== "author") {
        const selectedEntityNames = await pickEntities({
            grapherState,
            strategy,
            budget,
            readerCountry,
        })
        if (selectedEntityNames === undefined)
            return { svg: undefined, canPickEntities: true }
        if (selectedEntityNames.length > 0)
            runInAction(() =>
                grapherState.selection.setSelectedEntities(selectedEntityNames)
            )
    }

    dropUnlabelledLines(grapherState)

    const grapher = new Grapher({ grapherState })
    const svg = await grapher.grapherState.generateStaticSvg(
        ReactDOMServer.renderToStaticMarkup
    )
    const { sourcesLine } = grapherState
    if (budget === undefined)
        return { svg, canPickEntities: false, sourcesLine }
    const metrics = await measureThumbnail({
        grapherState,
        bounds: grapherState.chartAreaBounds,
        budget,
    })
    return { svg, canPickEntities: true, metrics, sourcesLine }
}

/** Fewest lines a line thumbnail keeps when dropping unlabelled ones */
const MIN_LABELLED_LINES = 2

/** Layout passes allowed for the labelled lines to settle */
const MAX_LABEL_PASSES = 3

/**
 * Deselects the entities whose lines lose their end label, as long as at
 * least MIN_LABELLED_LINES stay. Fewer lines change the layout, so it
 * repeats until every drawn line is labelled.
 */
function dropUnlabelledLines(grapherState: GrapherState): void {
    if (
        grapherState.activeTab !== GRAPHER_TAB_NAMES.LineChart ||
        (grapherState.chartState.seriesStrategy ?? SeriesStrategy.entity) !==
            SeriesStrategy.entity
    )
        return
    for (let pass = 0; pass < MAX_LABEL_PASSES; pass++) {
        const chart = new LineChartThumbnail({
            chartState: grapherState.chartState as LineChartState,
            bounds: grapherState.chartAreaBounds,
        })
        const labelledSeries = new Set(
            chart.placedEndLabels.map((label) => label.seriesName)
        )
        const drawnEntities = R.unique(
            chart.chartState.series.map((series) => series.entityName)
        )
        const labelledEntities = R.unique(
            chart.chartState.series
                .filter((series) => labelledSeries.has(series.seriesName))
                .map((series) => series.entityName)
        )
        if (
            labelledEntities.length === drawnEntities.length ||
            labelledEntities.length < MIN_LABELLED_LINES
        )
            return
        runInAction(() =>
            grapherState.selection.setSelectedEntities(labelledEntities)
        )
    }
}

/**
 * Draws a faceted chart as one panel when its indicators share a unit,
 * keeping only the first entity if it plots several indicators
 */
function removeFacets(grapherState: GrapherState): void {
    if (!grapherState.isFaceted || grapherState.isOnMapTab) return
    const units = R.unique(
        grapherState.yColumnsFromDimensions.map((column) => column.unit ?? "")
    )
    if (units.length > 1) return
    runInAction(() => {
        const { selectedEntityNames } = grapherState.selection
        if (
            grapherState.yColumnSlugs.length > 1 &&
            selectedEntityNames.length > 1
        )
            grapherState.selection.setSelectedEntities(
                selectedEntityNames.slice(0, 1)
            )
        grapherState.selectedFacetStrategy = FacetStrategy.none
    })
}

/** Starts a slope at the time most countries have data by, if that's later */
function moveSlopeStart(grapherState: GrapherState): void {
    const slopeStartTime = findSlopeStartTime(grapherState)
    const { startTime } = grapherState
    if (
        slopeStartTime === undefined ||
        startTime === undefined ||
        slopeStartTime <= startTime
    )
        return
    runInAction(() => {
        grapherState.timelineHandleTimeBounds = [
            slopeStartTime,
            grapherState.timelineHandleTimeBounds[1],
        ]
    })
}

/** How many entities to pick, or undefined if picking doesn't apply */
function findEntityBudget(grapherState: GrapherState): number | undefined {
    // Dumbbells draw a row per entity even when the author lets readers
    // pick only one country, as two-indicator dumbbells do
    const canPickEntities =
        !grapherState.isFaceted &&
        (grapherState.chartState.seriesStrategy ?? SeriesStrategy.entity) ===
            SeriesStrategy.entity &&
        (grapherState.addCountryMode === EntitySelectionMode.MultipleEntities ||
            grapherState.activeTab === GRAPHER_TAB_NAMES.Dumbbell)
    return canPickEntities ? ENTITY_BUDGET[grapherState.activeTab] : undefined
}

/** Inlined SVGs share one document, so their ids must not collide */
export function prefixSvgIds(svg: string, prefix: string): string {
    return svg
        .replace(/\bid="/g, `id="${prefix}-`)
        .replace(/url\(#/g, `url(#${prefix}-`)
        .replace(/href="#/g, `href="#${prefix}-`)
}

/** Response header saying whether the strategies apply to the chart */
const CAN_PICK_ENTITIES_HEADER = "X-Can-Pick-Entities"

/** Response header with the thumbnail's metrics as JSON */
const METRICS_HEADER = "X-Thumbnail-Metrics"

const PAGE_SCRIPT = `
const form = document.querySelector("form")
form.topic.addEventListener("change", () => form.submit())
form.country.addEventListener("change", () => form.submit())
form.type.addEventListener("change", () => {
    form.topic.value = "all"
    form.submit()
})
const STRATEGY_NAMES = ${escapeJSONStringForInlineScript(
    JSON.stringify(Object.fromEntries(STRATEGIES.map((s) => [s.id, s.name])))
)}
const SET_APART_IDS = new Set(${escapeJSONStringForInlineScript(
    JSON.stringify(STRATEGIES.filter((s) => s.isSetApart).map((s) => s.id))
)})
const scores = []
const format = (value) => (value === undefined ? "–" : value.toFixed(2))
function hide(cell) {
    cell.parentElement.classList.add("slot--hidden")
}
function showMetrics(cell, metrics) {
    const caption = cell.parentElement.querySelector(".metrics")
    const windowLine = metrics.latestValueWindow === undefined ? "" :
        metrics.latestValueWindowSource === "plotted time" ?
        "values from the plotted time only (" + Math.round(100 * metrics.latestValueCoverage) + "% of countries)" :
        "values ≤ " + metrics.latestValueWindow + " " +
        (metrics.latestValueWindow === 1 ? metrics.latestValueWindowUnit.slice(0, -1) : metrics.latestValueWindowUnit) + " old (" +
        metrics.latestValueWindowSource + ", " + Math.round(100 * metrics.latestValueCoverage) + "% of countries)"
    caption.replaceChildren(windowLine)
}
function loadCell(cell) {
    return fetch(cell.dataset.src)
        .then((r) => (r.ok ? r : Promise.reject(r.status)))
        .then(async (r) => {
            if (r.status === 204) hide(cell)
            else cell.innerHTML = await r.text()
            const metricsHeader = r.headers.get("${METRICS_HEADER}")
            const metrics = metricsHeader ? JSON.parse(metricsHeader) : undefined
            if (metrics && r.status !== 204) showMetrics(cell, metrics)
            return {
                canPickEntities: r.headers.get("${CAN_PICK_ENTITIES_HEADER}") === "true",
                metrics: r.status === 204 ? undefined : metrics,
            }
        })
        .catch((error) => {
            cell.textContent = "Failed: " + error
            cell.classList.add("cell--failed")
            return { canPickEntities: true }
        })
}
function markWinner(results) {
    const scored = results.filter((d) => d.metrics?.score !== undefined)
    const contenders = scored.filter((d) => !SET_APART_IDS.has(d.cell.dataset.strategy))
    if (contenders.length < 2) return
    const best = Math.max(...contenders.map((d) => d.metrics.score))
    for (const d of scored) {
        const isWinner = contenders.includes(d) && d.metrics.score === best
        scores.push({ strategy: d.cell.dataset.strategy, metrics: d.metrics, isWinner })
    }
    renderSummary()
}
function renderSummary() {
    const mean = (rows, key) => {
        const values = rows.map((d) => d.metrics[key]).filter((v) => v !== undefined)
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined
    }
    const rows = Object.entries(STRATEGY_NAMES).map(([id, name]) => {
        const own = scores.filter((d) => d.strategy === id)
        return { name, isSetApart: SET_APART_IDS.has(id), count: own.length, wins: own.filter((d) => d.isWinner).length,
            score: mean(own, "score"), legibility: mean(own, "legibility"),
            representativeness: mean(own, "representativeness"), familiarity: mean(own, "familiarity") }
    }).filter((d) => d.count > 0).sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    document.getElementById("summary").innerHTML =
        "<tr><th>Strategy</th><th>Rows</th><th>Wins</th><th>Score</th><th>L</th><th>R</th><th>F</th></tr>" +
        rows.map((d) => (d.isSetApart ? '<tr class="set-apart"><td>' + d.name + " (set apart)" : "<tr><td>" + d.name) + "</td><td>" + d.count + "</td><td>" + d.wins + "</td><td>" +
            format(d.score) + "</td><td>" + format(d.legibility) + "</td><td>" +
            format(d.representativeness) + "</td><td>" + format(d.familiarity) + "</td></tr>").join("")
}
// The first cell of a row says whether the other strategies apply
const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
        if (!entry.isIntersecting) continue
        const first = entry.target
        observer.unobserve(first)
        const others = [...document.querySelectorAll(".cell")].filter(
            (cell) => cell.dataset.row === first.dataset.row && cell !== first
        )
        loadCell(first).then(async (firstResult) => {
            if (!firstResult.canPickEntities) {
                others.forEach(hide)
                return
            }
            const otherResults = await Promise.all(
                others.map((cell) => loadCell(cell).then((result) => ({ ...result, cell })))
            )
            markWinner([{ ...firstResult, cell: first }, ...otherResults])
        })
    }
}, { rootMargin: "400px" })
document.querySelectorAll(".cell[data-is-first-in-row]").forEach((cell) => observer.observe(cell))
`

const PAGE_CSS = `
* { box-sizing: border-box; }
body { margin: 0; background: #f7f7f5; color: #1d2733; font: 14px/1.4 Lato, system-ui, sans-serif; }
header { position: sticky; top: 0; z-index: 2; background: #f7f7f5; border-bottom: 1px solid #dde2e8; padding: 12px 16px 0; width: max-content; min-width: 100%; }
h1 { font-size: 18px; margin: 0 0 8px; }
.note { color: #5b6878; margin: 0 0 10px; max-width: 900px; }
form { display: flex; flex-wrap: wrap; gap: 12px 20px; align-items: center; margin-bottom: 10px; }
.count { color: #5b6878; }
form label { color: #5b6878; }
select { font: inherit; padding: 4px 8px; border: 1px solid #dde2e8; border-radius: 4px; background: #fff; color: #1d2733; }
main { padding: 12px 16px 48px; width: max-content; }
.grid { display: grid; gap: 8px 12px; }
.slot--set-apart, .column-head--set-apart { margin-left: ${SET_APART_GAP_PX}px; }
.slot--hidden { visibility: hidden; }
.metrics { color: #5b6878; font-size: 11px; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.summary { display: none; }
.summary h2 { font-size: 15px; margin: 0 0 4px; }
.summary table { border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
.summary .set-apart { color: #8a96a3; }
.summary th, .summary td { padding: 3px 12px 3px 0; text-align: left; border-bottom: 1px solid #dde2e8; }
.column-head { padding: 6px 0 10px; }
.column-head strong { display: block; }
.column-head small, .row-label small { display: block; color: #5b6878; font-size: 12px; }
.row-label a { color: #1d3d63; font-weight: 700; word-break: break-word; text-decoration: none; }
.cell { background: #fff; border: 1px solid #dbe5f0; aspect-ratio: ${GRAPHER_THUMBNAIL_WIDTH} / ${GRAPHER_THUMBNAIL_HEIGHT}; overflow: hidden; }
.cell svg { width: 100%; height: 100%; display: block; }
.cell--failed { color: #b13507; padding: 8px; font-size: 12px; }
`
