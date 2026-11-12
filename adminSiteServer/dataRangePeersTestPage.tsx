import { Router } from "express"
import { runInAction } from "mobx"
import ReactDOMServer from "react-dom/server"
import {
    Grapher,
    GrapherState,
    GRAPHER_THUMBNAIL_WIDTH,
    GRAPHER_THUMBNAIL_HEIGHT,
    fetchInputTableForConfig,
    loadCatalogData,
    prepareEntitiesForPeerSelection,
    selectPeerCountries,
} from "@ourworldindata/grapher"
import {
    EntityName,
    GRAPHER_TAB_NAMES,
    GrapherInterface,
    GrapherVariant,
    PeerCountryStrategy,
} from "@ourworldindata/types"
import { Bounds } from "@ourworldindata/utils"
import { getChartConfigBySlug } from "../db/model/Chart.js"
import { renderToHtmlPage } from "../serverUtils/serverUtil.js"
import { getPlainRouteWithROTransaction } from "./plainRouterHelpers.js"
import { CATALOG_URL, DATA_API_URL } from "../settings/serverSettings.js"
import {
    DATA_RANGE_PEERS_TEST_SECTIONS,
    DataRangePeersTestCase,
    DataRangePeersTestSection,
} from "./dataRangePeersTestCases.js"
import { selectLegacyDataRangePeers } from "./legacyDataRangePeers.js"

const LIVE_BASE_URL = "https://ourworldindata.org"

/** Font size of `imVariant=simplified` images in functions/_common/imageLayout.ts */
const THUMBNAIL_FONT_SIZE = 14

const TARGET_OPTIONS = [
    "United States",
    "India",
    "China",
    "Nigeria",
    "Brazil",
    "Germany",
]

const COUNT_OPTIONS = [4, 5, 6, 12]

/** `targetCount` default of the dataRange strategy, old and new */
const DEFAULT_PEER_COUNT = 5

/** Query params the page reads itself rather than passing on to grapher */
const PAGE_PARAMS = ["algorithm", "target", "count"]

enum PeerAlgorithm {
    Old = "old",
    New = "new",
}

const PEER_ALGORITHM_LABELS: Record<PeerAlgorithm, string> = {
    [PeerAlgorithm.Old]: "Old",
    [PeerAlgorithm.New]: "New",
}

interface PeerOptions {
    targetCountry?: EntityName
    /** Number of slots, the target's included */
    count: number
}

export function addDataRangePeersTestRoutes(router: Router): void {
    getPlainRouteWithROTransaction(
        router,
        "/data-range-peers",
        async (req, res) => {
            const sectionId = readStringParam(req.query.type)
            const sections = DATA_RANGE_PEERS_TEST_SECTIONS.filter(
                (section) => !sectionId || section.id === sectionId
            )
            res.send(
                renderToHtmlPage(
                    <DataRangePeersTestPage
                        sections={sections}
                        sectionId={sectionId}
                        peerOptions={readPeerOptions(req.query)}
                    />
                )
            )
        }
    )

    getPlainRouteWithROTransaction(
        router,
        "/data-range-peers/:slug.svg",
        async (req, res, trx) => {
            const algorithm =
                Object.values(PeerAlgorithm).find(
                    (value) => value === req.query.algorithm
                ) ?? PeerAlgorithm.New
            const peerOptions = readPeerOptions(req.query)
            const grapherParams = new URLSearchParams(
                req.query as Record<string, string>
            )
            for (const param of PAGE_PARAMS) grapherParams.delete(param)
            const queryStr = grapherParams.toString()

            try {
                const { config } = await getChartConfigBySlug(
                    trx,
                    req.params.slug
                )
                let peers: EntityName[] = []
                const svg = await renderThumbnailSvg(
                    config,
                    queryStr,
                    async (grapherState) => {
                        peers = await selectDataRangePeers(
                            grapherState,
                            algorithm,
                            peerOptions
                        )
                        grapherState.selection.setSelectedEntities(
                            peerOptions.targetCountry
                                ? [peerOptions.targetCountry, ...peers]
                                : peers
                        )
                    }
                )
                res.setHeader("Content-Type", "image/svg+xml")
                res.setHeader(
                    "X-Peers",
                    encodeURIComponent(
                        JSON.stringify({
                            peers,
                            // the target takes one of the slots
                            count: peerOptions.targetCountry
                                ? peerOptions.count - 1
                                : peerOptions.count,
                        })
                    )
                )
                res.send(
                    prefixSvgIds(
                        svg,
                        `${req.params.slug}-${algorithm}-${hashQueryStr(queryStr)}`
                    )
                )
            } catch (error) {
                res.status(500).send(String(error))
            }
        }
    )
}

async function selectDataRangePeers(
    grapherState: GrapherState,
    algorithm: PeerAlgorithm,
    { targetCountry, count }: PeerOptions
): Promise<EntityName[]> {
    if (algorithm === PeerAlgorithm.Old)
        return selectLegacyDataRangePeers({
            grapherState,
            targetCountry,
            targetCount: count,
        })

    return selectPeerCountries({
        peerCountryStrategy: PeerCountryStrategy.DataRange,
        targetCountry,
        availableEntities: prepareEntitiesForPeerSelection(grapherState),
        dataColumn: grapherState.table.get(grapherState.yColumnSlug),
        endTime: grapherState.endTime,
        isSingleTimeChart: grapherState.isSingleTimeSelectionActive,
        additionalDataLoaderFn: grapherState.additionalDataLoaderFn,
        targetCount: count,
    })
}

/** Mirrors `resolveThumbnailLayout` in functions/_common/imageLayout.ts */
async function renderThumbnailSvg(
    config: GrapherInterface,
    queryStr: string,
    onDataLoaded: (grapherState: GrapherState) => Promise<void>
): Promise<string> {
    const bounds = new Bounds(
        0,
        0,
        GRAPHER_THUMBNAIL_WIDTH,
        GRAPHER_THUMBNAIL_HEIGHT
    )
    const grapherState = new GrapherState({
        ...config,
        bakedGrapherURL: `${LIVE_BASE_URL}/grapher`,
        queryStr: `?${queryStr}`,
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
    })

    if (grapherState.activeTab === GRAPHER_TAB_NAMES.Table)
        grapherState.resetToDefaultTab()

    const inputTable = await fetchInputTableForConfig({
        dimensions: grapherState.dimensionConfigs,
        selectedEntityColors: grapherState.selectedEntityColors,
        dataApiUrl: DATA_API_URL,
    })
    if (inputTable) grapherState.inputTable = inputTable
    await onDataLoaded(grapherState)

    const grapher = new Grapher({ grapherState })
    return grapher.grapherState.generateStaticSvg(
        ReactDOMServer.renderToStaticMarkup
    )
}

function DataRangePeersTestPage({
    sections,
    sectionId,
    peerOptions,
}: {
    sections: DataRangePeersTestSection[]
    sectionId?: string
    peerOptions: PeerOptions
}): React.ReactElement {
    const style = PAGE_STYLE.replaceAll(
        "{{width}}",
        String(GRAPHER_THUMBNAIL_WIDTH)
    ).replaceAll("{{height}}", String(GRAPHER_THUMBNAIL_HEIGHT))
    return (
        <html>
            <head>
                <meta charSet="utf-8" />
                <title>Test Data Range Peers</title>
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap"
                />
                <style dangerouslySetInnerHTML={{ __html: style }} />
            </head>
            <body>
                <form className="controls" method="get">
                    <select name="type" defaultValue={sectionId ?? ""}>
                        <option value="">All sections</option>
                        {DATA_RANGE_PEERS_TEST_SECTIONS.map((section) => (
                            <option key={section.id} value={section.id}>
                                {section.title}
                            </option>
                        ))}
                    </select>
                    <select
                        name="target"
                        defaultValue={peerOptions.targetCountry ?? ""}
                    >
                        <option value="">No target (editor)</option>
                        {TARGET_OPTIONS.map((target) => (
                            <option key={target} value={target}>
                                Target: {target} (search)
                            </option>
                        ))}
                    </select>
                    <select
                        name="count"
                        defaultValue={String(peerOptions.count)}
                    >
                        {COUNT_OPTIONS.map((count) => (
                            <option key={count} value={count}>
                                {count} slots
                            </option>
                        ))}
                    </select>
                </form>
                <p className="summary">
                    Old: equal-count buckets over each country's value in one
                    year. New: evenly spaced values over each entity's latest
                    value in a window. Picks only one side makes are in bold.
                    The default of 5 slots is the strategy's own; with a target,
                    one of them is the target's.
                </p>
                <p className="summary summary--stats" />
                {sections.map((section) => (
                    <section key={section.id} className="section">
                        <h2>{section.title}</h2>
                        <div className="grid">
                            {section.cases.map((testCase, index) => (
                                <ComparisonCard
                                    key={index}
                                    testCase={testCase}
                                    peerOptions={peerOptions}
                                />
                            ))}
                        </div>
                    </section>
                ))}
                <script dangerouslySetInnerHTML={{ __html: PAGE_SCRIPT }} />
            </body>
        </html>
    )
}

function ComparisonCard({
    testCase,
    peerOptions,
}: {
    testCase: DataRangePeersTestCase
    peerOptions: PeerOptions
}): React.ReactElement {
    const liveUrl = `${LIVE_BASE_URL}/grapher/${testCase.slug}${testCase.queryStr ? `?${testCase.queryStr}` : ""}`
    return (
        <figure className="card">
            <figcaption className="card__label">
                <a href={liveUrl} target="_blank" rel="noopener">
                    {testCase.slug}
                </a>{" "}
                <span className="card__note">{testCase.label}</span>
                <span className="card__overlap" />
            </figcaption>
            <div className="card__algorithms">
                {Object.values(PeerAlgorithm).map((algorithm) => (
                    <div key={algorithm} className="card__algorithm">
                        <span className="column-heading">
                            {PEER_ALGORITHM_LABELS[algorithm]}
                        </span>
                        <div
                            className="thumbnail"
                            data-algorithm={algorithm}
                            data-src={makeSvgUrl(
                                testCase,
                                algorithm,
                                peerOptions
                            )}
                        />
                        <ol className="peers" data-algorithm={algorithm} />
                    </div>
                ))}
            </div>
        </figure>
    )
}

function makeSvgUrl(
    { slug, queryStr }: DataRangePeersTestCase,
    algorithm: PeerAlgorithm,
    { targetCountry, count }: PeerOptions
): string {
    const params = new URLSearchParams(queryStr)
    params.set("algorithm", algorithm)
    if (targetCountry) params.set("target", targetCountry)
    params.set("count", String(count))
    return `/admin/test/data-range-peers/${slug}.svg?${params}`
}

function readPeerOptions(query: Record<string, unknown>): PeerOptions {
    const target = readStringParam(query.target)
    return {
        targetCountry:
            target && TARGET_OPTIONS.includes(target) ? target : undefined,
        count: readPositiveIntParam(query.count) ?? DEFAULT_PEER_COUNT,
    }
}

/** Inline SVGs share the page's id namespace, so unprefixed clip paths and gradients collide */
function prefixSvgIds(svg: string, prefix: string): string {
    return svg
        .replace(/\bid="/g, `id="${prefix}-`)
        .replace(/url\(#/g, `url(#${prefix}-`)
        .replace(/href="#/g, `href="#${prefix}-`)
}

function hashQueryStr(queryStr: string): string {
    let value = 0
    for (const char of queryStr) value = (value * 31 + char.charCodeAt(0)) | 0
    return (value >>> 0).toString(36)
}

function readStringParam(value: unknown): string | undefined {
    return typeof value === "string" && value ? value : undefined
}

function readPositiveIntParam(value: unknown): number | undefined {
    const number = Number(value)
    return Number.isInteger(number) && number > 0 ? number : undefined
}

const PAGE_STYLE = `
body {
    max-width: 1400px;
    margin: 0 auto;
    padding: 16px 24px 48px;
    background: #f7f7f5;
    color: #1d2733;
    font: 14px/1.4 Lato, system-ui, sans-serif;
}

.controls {
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    align-items: center;
}

.summary {
    max-width: 760px;
    color: #4d5562;
}

.summary--stats {
    font-weight: 700;
}

.section h2 {
    margin: 32px 0 12px;
    font-size: 18px;
}

.grid {
    display: flex;
    flex-direction: column;
    gap: 40px;
}

.card {
    margin: 0;
}

.card__label {
    max-width: calc({{width}}px * 2 + 24px);
    margin-bottom: 6px;
    font-weight: 700;
}

.card__label a {
    color: inherit;
}

.card__note {
    color: #6e7581;
    font-weight: 400;
}

.card__overlap {
    display: block;
    color: #6e7581;
    font-size: 12px;
    font-weight: 400;
}

.card__overlap--disjoint {
    color: #b23b3b;
}

.card__algorithms {
    display: flex;
    gap: 24px;
}

.card__algorithm {
    width: {{width}}px;
}

.column-heading {
    display: block;
    margin-bottom: 4px;
    color: #6e7581;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
}

.thumbnail {
    width: {{width}}px;
    height: {{height}}px;
    background: #fff;
    outline: 1px solid #d0d3d8;
}

.thumbnail svg {
    display: block;
    overflow: visible;
}

.thumbnail--error {
    padding: 8px;
    box-sizing: border-box;
    color: #b23b3b;
    font-size: 11px;
    overflow: auto;
}

.peers {
    margin: 6px 0 0;
    padding-left: 20px;
    font-size: 12px;
}

.peers__peer--unique {
    font-weight: 700;
}

.peers__short {
    list-style: none;
    margin-left: -20px;
    color: #b23b3b;
}
`

const PAGE_SCRIPT = `
const form = document.querySelector(".controls")
form.addEventListener("change", () => form.submit())

const stats = { charts: 0, shared: 0, oldPicks: 0, newPicks: 0, oldShort: 0, newShort: 0, disjoint: 0 }

function renderStats() {
    const element = document.querySelector(".summary--stats")
    element.textContent =
        stats.charts + " charts loaded. Old and new share " + stats.shared +
        " picks (old " + stats.oldPicks + ", new " + stats.newPicks + "). " +
        stats.disjoint + " charts share nothing. Old is short on " +
        stats.oldShort + " charts, new on " + stats.newShort + "."
}

async function load(element) {
    try {
        const response = await fetch(element.dataset.src)
        const text = await response.text()
        if (!response.ok) throw new Error(text)
        element.innerHTML = text
        return JSON.parse(decodeURIComponent(response.headers.get("X-Peers")))
    } catch (error) {
        element.classList.add("thumbnail--error")
        element.textContent = String(error.message ?? error)
        return undefined
    }
}

function renderPeers(list, result, otherPeers) {
    for (const peer of result.peers) {
        const item = document.createElement("li")
        item.textContent = peer
        if (otherPeers && !otherPeers.includes(peer))
            item.className = "peers__peer--unique"
        list.append(item)
    }
    if (result.peers.length < result.count) {
        const item = document.createElement("li")
        item.className = "peers__short"
        item.textContent = result.peers.length + " of " + result.count
        list.append(item)
    }
}

async function loadCard(card) {
    const [oldResult, newResult] = await Promise.all(
        [...card.querySelectorAll(".thumbnail")].map(load)
    )
    if (oldResult)
        renderPeers(card.querySelector(".peers[data-algorithm=old]"), oldResult, newResult?.peers)
    if (newResult)
        renderPeers(card.querySelector(".peers[data-algorithm=new]"), newResult, oldResult?.peers)
    if (!oldResult || !newResult) return

    const shared = oldResult.peers.filter((peer) => newResult.peers.includes(peer)).length
    const isDisjoint = shared === 0 && (oldResult.peers.length > 0 || newResult.peers.length > 0)
    const overlap = card.querySelector(".card__overlap")
    overlap.textContent = shared + " shared"
    if (isDisjoint) overlap.classList.add("card__overlap--disjoint")

    stats.charts++
    stats.shared += shared
    stats.oldPicks += oldResult.peers.length
    stats.newPicks += newResult.peers.length
    if (oldResult.peers.length < oldResult.count) stats.oldShort++
    if (newResult.peers.length < newResult.count) stats.newShort++
    if (isDisjoint) stats.disjoint++
    renderStats()
}

const observer = new IntersectionObserver(
    (entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue
            observer.unobserve(entry.target)
            void loadCard(entry.target)
        }
    },
    { rootMargin: "400px" }
)
for (const element of document.querySelectorAll(".card"))
    observer.observe(element)
`
