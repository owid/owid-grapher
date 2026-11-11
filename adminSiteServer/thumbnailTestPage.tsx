import { Router } from "express"
import { runInAction } from "mobx"
import ReactDOMServer from "react-dom/server"
import {
    Grapher,
    GrapherState,
    fetchInputTableForConfig,
    generateFocusedSeriesNamesParam,
    loadCatalogData,
    GRAPHER_THUMBNAIL_WIDTH,
    GRAPHER_THUMBNAIL_HEIGHT,
} from "@ourworldindata/grapher"
import {
    ChartLabelMode,
    GrapherInterface,
    GrapherVariant,
    GRAPHER_TAB_NAMES,
} from "@ourworldindata/types"
import { Bounds } from "@ourworldindata/utils"
import { getChartConfigBySlug } from "../db/model/Chart.js"
import { renderToHtmlPage } from "../serverUtils/serverUtil.js"
import { getPlainRouteWithROTransaction } from "./plainRouterHelpers.js"
import { CATALOG_URL, DATA_API_URL } from "../settings/serverSettings.js"
import {
    THUMBNAIL_TEST_SECTIONS,
    ThumbnailTestCase,
    ThumbnailTestSection,
} from "./thumbnailTestCases.js"
import { sampleThumbnailTestSections } from "./thumbnailTestSample.js"

/** Font size of `imVariant=simplified` images in functions/_common/imageLayout.ts */
export const THUMBNAIL_FONT_SIZE = 14

export const LIVE_BASE_URL = "https://ourworldindata.org"

export const SAMPLE_COUNT_OPTIONS = [5, 10, 20]

const LABEL_MODES = Object.values(ChartLabelMode)

export interface SampleOptions {
    countPerSection: number
    seed: number
}

export function addThumbnailTestRoutes(router: Router): void {
    getPlainRouteWithROTransaction(
        router,
        "/thumbnails",
        async (req, res, trx) => {
            const countPerSection = readPositiveIntParam(req.query.sample)
            const seed = readPositiveIntParam(req.query.seed)
            if (countPerSection !== undefined && seed === undefined) {
                const params = new URLSearchParams(
                    req.query as Record<string, string>
                )
                params.set("seed", String(makeRandomSeed()))
                res.redirect(`${req.baseUrl}${req.path}?${params}`)
                return
            }
            const sample =
                countPerSection !== undefined && seed !== undefined
                    ? { countPerSection, seed }
                    : undefined
            const sectionId = readStringParam(req.query.type)
            const focus = readStringParam(req.query.focus)
            const focusedEntityNames = parseEntityNames(focus)
            const sections = (
                sample
                    ? await sampleThumbnailTestSections(trx, sample)
                    : THUMBNAIL_TEST_SECTIONS
            )
                .filter((section) => !sectionId || section.id === sectionId)
                .map((section) => ({
                    ...section,
                    cases: section.cases.map((testCase) =>
                        applyFocus(testCase, focusedEntityNames)
                    ),
                }))
            res.send(
                renderToHtmlPage(
                    <ThumbnailTestPage
                        sections={sections}
                        sectionId={sectionId}
                        sample={sample}
                        focus={focus}
                        shouldCompareWithLive={req.query.compare === "1"}
                        scale={readScaleParam(req.query.scale)}
                    />
                )
            )
        }
    )

    getPlainRouteWithROTransaction(
        router,
        "/thumbnails/:slug.svg",
        async (req, res, trx) => {
            const params = new URLSearchParams(
                req.query as Record<string, string>
            )
            const idPrefix = `${req.params.slug}-${hashQueryStr(params.toString())}`
            const labelMode = readLabelModeParam(params.get("imLabels"))
            params.delete("imLabels")
            try {
                const { config } = await getChartConfigBySlug(
                    trx,
                    req.params.slug
                )
                const svg = await renderImageSvg(config, params.toString(), {
                    variant: GrapherVariant.Thumbnail,
                    labelMode,
                    widthPx: GRAPHER_THUMBNAIL_WIDTH,
                    heightPx: GRAPHER_THUMBNAIL_HEIGHT,
                    fontSize: THUMBNAIL_FONT_SIZE,
                })
                res.setHeader("Content-Type", "image/svg+xml")
                res.send(prefixSvgIds(svg, idPrefix))
            } catch (error) {
                res.status(500).send(String(error))
            }
        }
    )
}

export interface TestImageOptions {
    variant: GrapherVariant
    labelMode: ChartLabelMode
    widthPx: number
    heightPx: number
    fontSize: number | undefined
}

/** Mirrors `initGrapher` in functions/_common/grapherTools.ts, keep the two in sync */
export async function renderImageSvg(
    config: GrapherInterface,
    queryStr: string,
    { variant, labelMode, widthPx, heightPx, fontSize }: TestImageOptions
): Promise<string> {
    const bounds = new Bounds(0, 0, widthPx, heightPx)
    const grapherState = new GrapherState({
        ...config,
        bakedGrapherURL: `${LIVE_BASE_URL}/grapher`,
        queryStr: `?${queryStr}`,
        bounds,
        staticBounds: bounds,
        baseFontSize: fontSize,
        variant,
        labelMode,
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

    const grapher = new Grapher({ grapherState })
    return grapher.grapherState.generateStaticSvg(
        ReactDOMServer.renderToStaticMarkup
    )
}

function ThumbnailTestPage({
    sections,
    sectionId,
    sample,
    focus,
    shouldCompareWithLive,
    scale,
}: {
    sections: ThumbnailTestSection[]
    sectionId?: string
    sample?: SampleOptions
    focus?: string
    shouldCompareWithLive: boolean
    scale: number
}): React.ReactElement {
    const style = PAGE_STYLE.replaceAll(
        "{{width}}",
        String(GRAPHER_THUMBNAIL_WIDTH)
    )
        .replaceAll("{{height}}", String(GRAPHER_THUMBNAIL_HEIGHT))
        .replaceAll("{{scale}}", String(scale))
    return (
        <html>
            <head>
                <meta charSet="utf-8" />
                <title>Test Thumbnails</title>
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap"
                />
                <style dangerouslySetInnerHTML={{ __html: style }} />
            </head>
            <body>
                <form className="controls" method="get">
                    <select name="type" defaultValue={sectionId ?? ""}>
                        <option value="">All chart types</option>
                        {THUMBNAIL_TEST_SECTIONS.map((section) => (
                            <option key={section.id} value={section.id}>
                                {section.title}
                            </option>
                        ))}
                    </select>
                    <select
                        name="sample"
                        defaultValue={String(sample?.countPerSection ?? "")}
                    >
                        <option value="">Curated cases</option>
                        {SAMPLE_COUNT_OPTIONS.map((count) => (
                            <option key={count} value={count}>
                                Random sample, {count} per type
                            </option>
                        ))}
                    </select>
                    {sample && (
                        <>
                            <label>
                                Seed{" "}
                                <input
                                    className="controls__seed"
                                    type="number"
                                    name="seed"
                                    defaultValue={sample.seed}
                                />
                            </label>
                            <button type="button" className="controls__shuffle">
                                Shuffle
                            </button>
                        </>
                    )}
                    <label>
                        Focus{" "}
                        <input
                            type="text"
                            name="focus"
                            placeholder="France, Germany"
                            defaultValue={focus}
                        />
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            name="compare"
                            value="1"
                            defaultChecked={shouldCompareWithLive}
                        />{" "}
                        Compare with live
                    </label>
                    <select name="scale" defaultValue={String(scale)}>
                        <option value="1">1×</option>
                        <option value="1.5">1.5×</option>
                        <option value="2">2×</option>
                    </select>
                </form>
                {sections.map((section) => (
                    <ThumbnailTestSectionView
                        key={section.id}
                        section={section}
                        shouldCompareWithLive={shouldCompareWithLive}
                    />
                ))}
                <script dangerouslySetInnerHTML={{ __html: PAGE_SCRIPT }} />
            </body>
        </html>
    )
}

function ThumbnailTestSectionView({
    section,
    shouldCompareWithLive,
}: {
    section: ThumbnailTestSection
    shouldCompareWithLive: boolean
}): React.ReactElement {
    return (
        <section className="section">
            <h2>{section.title}</h2>
            <div className="card__thumbnails column-headings">
                {shouldCompareWithLive && (
                    <span className="column-heading">Live</span>
                )}
                {LABEL_MODES.map((labelMode) => (
                    <span key={labelMode} className="column-heading">
                        imLabels={labelMode}
                    </span>
                ))}
            </div>
            <div className="grid">
                {section.cases.map((testCase, index) => (
                    <figure key={index} className="card">
                        <figcaption
                            className="card__label"
                            title={testCase.label}
                        >
                            {testCase.label}
                        </figcaption>
                        <a
                            className="card__thumbnails"
                            href={makeLiveUrl(testCase)}
                            title={makeLiveUrl(testCase)}
                            target="_blank"
                            rel="noopener"
                        >
                            {shouldCompareWithLive && (
                                <img
                                    className="thumbnail"
                                    src={makeLivePngUrl(testCase)}
                                    loading="lazy"
                                    alt=""
                                />
                            )}
                            {LABEL_MODES.map((labelMode) => (
                                <div
                                    key={labelMode}
                                    className="thumbnail thumbnail--local"
                                    data-src={makeSvgUrl(testCase, labelMode)}
                                />
                            ))}
                        </a>
                    </figure>
                ))}
            </div>
        </section>
    )
}

const PAGE_STYLE = `
body {
    width: fit-content;
    margin: 0 auto;
    padding: 16px 24px 48px;
    background: #f7f7f5;
    color: #1d2733;
    font: 14px/1.4 Lato, system-ui, sans-serif;
}

.controls {
    display: flex;
    gap: 16px;
    align-items: center;
}

.section h2 {
    margin: 32px 0 12px;
    font-size: 18px;
}

.grid {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.column-headings {
    position: sticky;
    top: 0;
    z-index: 1;
    padding-top: 8px;
    background: #f7f7f5;
}

.column-heading {
    width: calc({{width}}px * {{scale}});
    margin-bottom: 8px;
    color: #6e7581;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
}

.card {
    margin: 0;
}

.card__label {
    display: block;
    max-width: calc({{width}}px * {{scale}});
    margin-bottom: 6px;
    overflow: hidden;
    font-weight: 700;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.card__thumbnails {
    display: flex;
    gap: 12px;
    width: fit-content;
}

.thumbnail {
    width: {{width}}px;
    height: {{height}}px;
    zoom: {{scale}};
    background: #fff;
    outline: 1px solid #d0d3d8;
}

.thumbnail--local svg {
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
`

export const PAGE_SCRIPT = `
const form = document.querySelector(".controls")
form.addEventListener("change", () => form.submit())
form.querySelector(".controls__shuffle")?.addEventListener("click", () => {
    form.elements.seed.value = String(1 + Math.floor(Math.random() * 999999))
    form.submit()
})

async function load(element) {
    try {
        const response = await fetch(element.dataset.src)
        const text = await response.text()
        if (!response.ok) throw new Error(text)
        element.innerHTML = text
    } catch (error) {
        element.classList.add("thumbnail--error")
        element.textContent = String(error.message ?? error)
    }
}

const observer = new IntersectionObserver(
    (entries) => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue
            observer.unobserve(entry.target)
            void load(entry.target)
        }
    },
    { rootMargin: "400px" }
)
for (const element of document.querySelectorAll(".thumbnail--local"))
    observer.observe(element)
`

/** Inline SVGs share the page's id namespace, so unprefixed clip paths and gradients collide */
export function prefixSvgIds(svg: string, prefix: string): string {
    return svg
        .replace(/\bid="/g, `id="${prefix}-`)
        .replace(/url\(#/g, `url(#${prefix}-`)
        .replace(/href="#/g, `href="#${prefix}-`)
}

export function hashQueryStr(queryStr: string): string {
    let value = 0
    for (const char of queryStr) value = (value * 31 + char.charCodeAt(0)) | 0
    return (value >>> 0).toString(36)
}

export function readStringParam(value: unknown): string | undefined {
    return typeof value === "string" && value ? value : undefined
}

export function parseEntityNames(value: string | undefined): string[] {
    return (value ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter((name) => name !== "")
}

export function applyFocus(
    testCase: ThumbnailTestCase,
    focusedEntityNames: string[]
): ThumbnailTestCase {
    if (focusedEntityNames.length === 0) return testCase
    const params = new URLSearchParams(testCase.queryStr)
    params.set("focus", generateFocusedSeriesNamesParam(focusedEntityNames))
    return { ...testCase, queryStr: params.toString() }
}

export function readPositiveIntParam(value: unknown): number | undefined {
    const number = Number(value)
    return Number.isInteger(number) && number > 0 ? number : undefined
}

export function makeRandomSeed(): number {
    return 1 + Math.floor(Math.random() * 999_999)
}

export function readScaleParam(value: unknown): number {
    const scale = Number(value)
    return Number.isFinite(scale) && scale > 0 ? scale : 1
}

function readLabelModeParam(value: string | null): ChartLabelMode {
    return (
        LABEL_MODES.find((labelMode) => labelMode === value) ??
        ChartLabelMode.All
    )
}

function makeSvgUrl(
    { slug, queryStr }: ThumbnailTestCase,
    labelMode: ChartLabelMode
): string {
    const params = new URLSearchParams(queryStr)
    params.set("imLabels", labelMode)
    return `/admin/test/thumbnails/${slug}.svg?${params}`
}

export function makeLiveUrl({ slug, queryStr }: ThumbnailTestCase): string {
    return `${LIVE_BASE_URL}/grapher/${slug}${queryStr ? `?${queryStr}` : ""}`
}

function makeLivePngUrl(testCase: ThumbnailTestCase): string {
    const params = new URLSearchParams(testCase.queryStr)
    params.set("imType", "thumbnail")
    return `${LIVE_BASE_URL}/grapher/${testCase.slug}.png?${params}`
}
