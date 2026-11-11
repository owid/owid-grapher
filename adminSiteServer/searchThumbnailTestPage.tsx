import { Router } from "express"
import {
    GrapherState,
    GRAPHER_THUMBNAIL_HEIGHT,
    GRAPHER_THUMBNAIL_WIDTH,
    parseImageRequest,
    serializeImageRequest,
    type ImageRequest,
} from "@ourworldindata/grapher"
import {
    ChartLabelMode,
    GrapherTabName,
    GrapherVariant,
    GRAPHER_TAB_NAMES,
} from "@ourworldindata/types"
import { getChartConfigBySlug } from "../db/model/Chart.js"
import { renderToHtmlPage } from "../serverUtils/serverUtil.js"
import { getPlainRouteWithROTransaction } from "./plainRouterHelpers.js"
import {
    THUMBNAIL_TEST_SECTIONS,
    ThumbnailTestCase,
    ThumbnailTestSection,
} from "./thumbnailTestCases.js"
import { sampleThumbnailTestSections } from "./thumbnailTestSample.js"
import {
    LIVE_BASE_URL,
    PAGE_SCRIPT,
    SAMPLE_COUNT_OPTIONS,
    SampleOptions,
    THUMBNAIL_FONT_SIZE,
    applyFocus,
    hashQueryStr,
    makeLiveUrl,
    makeRandomSeed,
    parseEntityNames,
    prefixSvgIds,
    readPositiveIntParam,
    readScaleParam,
    readStringParam,
    renderImageSvg,
} from "./thumbnailTestPage.js"

const THUMBNAIL_PNG_SCALE = 4
const SMALLER_FONT_SIZE = 12
const LARGE_PREVIEW_WIDTH_PX = 4 * GRAPHER_THUMBNAIL_WIDTH
const LARGE_PREVIEW_HEIGHT_PX = 4 * GRAPHER_THUMBNAIL_HEIGHT
const DEFAULT_NUM_PIXELS = 850 * 600

/** Mirrors `TABS_WITH_SMALLER_THUMBNAIL_FONT` in site/search/SearchChartHitRichDataHelpers.ts */
const TABS_WITH_SMALLER_THUMBNAIL_FONT: GrapherTabName[] = [
    GRAPHER_TAB_NAMES.WorldMap,
    GRAPHER_TAB_NAMES.DiscreteBar,
    GRAPHER_TAB_NAMES.StackedDiscreteBar,
    GRAPHER_TAB_NAMES.Swimlane,
    GRAPHER_TAB_NAMES.Dumbbell,
]

interface SearchVariant {
    id: string
    variant: GrapherVariant
    heading: string
    /** Multiplies the page scale for this variant's thumbnails */
    displayScale: number
    /** Legacy production params that render the same image */
    makeLegacyParams: (fontSize: number | undefined) => URLSearchParams
    makeRequest: (fontSize: number | undefined) => ImageRequest
}

const SEARCH_VARIANTS: SearchVariant[] = [
    {
        id: "simplified-all",
        variant: GrapherVariant.Thumbnail,
        heading: "simplified · all",
        displayScale: 1,
        makeLegacyParams: (fontSize) =>
            makeThumbnailLegacyParams({ isMinimal: false, fontSize }),
        makeRequest: (fontSize) =>
            makeThumbnailRequest(ChartLabelMode.All, fontSize),
    },
    {
        id: "simplified-values",
        variant: GrapherVariant.Thumbnail,
        heading: "simplified · values",
        displayScale: 1,
        makeLegacyParams: (fontSize) =>
            makeThumbnailLegacyParams({ isMinimal: true, fontSize }),
        makeRequest: (fontSize) =>
            makeThumbnailRequest(ChartLabelMode.Values, fontSize),
    },
    {
        id: "uncaptioned-values",
        variant: GrapherVariant.Uncaptioned,
        heading: `uncaptioned · values · ${LARGE_PREVIEW_WIDTH_PX}×${LARGE_PREVIEW_HEIGHT_PX}`,
        displayScale: 0.5,
        makeLegacyParams: () =>
            new URLSearchParams({
                imType: "uncaptioned",
                imMinimal: "1",
                imWidth: String(LARGE_PREVIEW_WIDTH_PX),
                imHeight: String(LARGE_PREVIEW_HEIGHT_PX),
            }),
        makeRequest: () => ({
            variant: GrapherVariant.Uncaptioned,
            labelMode: ChartLabelMode.Values,
            size: {
                kind: "explicit",
                width: LARGE_PREVIEW_WIDTH_PX,
                height: LARGE_PREVIEW_HEIGHT_PX,
            },
            includeDetails: false,
        }),
    },
]

interface SearchThumbnailTestCase extends ThumbnailTestCase {
    fontSize: number | undefined
}

interface SearchThumbnailTestSection extends ThumbnailTestSection {
    cases: SearchThumbnailTestCase[]
}

interface SvgLayout {
    widthPx: number
    heightPx: number
    fontSize: number | undefined
}

export function addSearchThumbnailTestRoutes(router: Router): void {
    getPlainRouteWithROTransaction(
        router,
        "/search-thumbnails",
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
            const baseSections = (
                sample
                    ? await sampleThumbnailTestSections(trx, sample)
                    : THUMBNAIL_TEST_SECTIONS
            ).filter((section) => !sectionId || section.id === sectionId)

            const sections: SearchThumbnailTestSection[] = []
            for (const section of baseSections) {
                const cases: SearchThumbnailTestCase[] = []
                for (const testCase of section.cases) {
                    const focusedCase = applyFocus(testCase, focusedEntityNames)
                    const { config } = await getChartConfigBySlug(
                        trx,
                        testCase.slug
                    )
                    cases.push({
                        ...focusedCase,
                        fontSize: findFontSize(
                            new GrapherState({
                                ...config,
                                queryStr: `?${focusedCase.queryStr ?? ""}`,
                            })
                        ),
                    })
                }
                sections.push({ ...section, cases })
            }
            res.send(
                renderToHtmlPage(
                    <SearchThumbnailTestPage
                        sections={sections}
                        sectionId={sectionId}
                        sample={sample}
                        focus={focus}
                        variant={readVariantParam(req.query.variant)}
                        scale={readScaleParam(req.query.scale)}
                    />
                )
            )
        }
    )

    getPlainRouteWithROTransaction(
        router,
        "/search-thumbnails/:slug.svg",
        async (req, res, trx) => {
            const params = new URLSearchParams(
                req.query as Record<string, string>
            )
            const idPrefix = `${req.params.slug}-${hashQueryStr(params.toString())}`
            const parsed = parseImageRequest(params)
            if (!parsed.ok) {
                res.status(400).send(
                    `${parsed.error.param}: ${parsed.error.reason}`
                )
                return
            }
            const { request } = parsed
            for (const key of Array.from(params.keys()))
                if (key.startsWith("im")) params.delete(key)
            const layout = resolveSvgLayout(request)
            try {
                const { config } = await getChartConfigBySlug(
                    trx,
                    req.params.slug
                )
                const svg = await renderImageSvg(config, params.toString(), {
                    variant: request.variant,
                    labelMode: request.labelMode,
                    ...layout,
                })
                res.setHeader("Content-Type", "image/svg+xml")
                res.send(prefixSvgIds(svg, idPrefix))
            } catch (error) {
                res.status(500).send(String(error))
            }
        }
    )
}

function findFontSize(grapherState: GrapherState): number | undefined {
    if (grapherState.activeTab === GRAPHER_TAB_NAMES.Table)
        grapherState.resetToDefaultTab()
    return TABS_WITH_SMALLER_THUMBNAIL_FONT.includes(grapherState.activeTab)
        ? SMALLER_FONT_SIZE
        : undefined
}

function makeThumbnailRequest(
    labelMode: ChartLabelMode.All | ChartLabelMode.Values,
    fontSize: number | undefined
): ImageRequest {
    return {
        variant: GrapherVariant.Thumbnail,
        labelMode,
        size: { kind: "explicit", ...(fontSize && { fontSize }) },
        includeDetails: false,
    }
}

function makeThumbnailLegacyParams({
    isMinimal,
    fontSize,
}: {
    isMinimal: boolean
    fontSize: number | undefined
}): URLSearchParams {
    const params = new URLSearchParams({
        imType: "thumbnail",
        imMinimal: isMinimal ? "1" : "0",
    })
    if (fontSize) params.set("imFontSize", String(fontSize))
    return params
}

/** Mirrors `resolveImageLayout` in functions/_common/imageLayout.ts for explicit sizes, keep the two in sync */
function resolveSvgLayout(request: ImageRequest): SvgLayout {
    if (request.size.kind === "preset")
        throw new Error("Preset sizes are not requested by search")
    const { width, height, fontSize } = request.size

    if (request.variant === GrapherVariant.Thumbnail)
        return {
            widthPx:
                (width ?? THUMBNAIL_PNG_SCALE * GRAPHER_THUMBNAIL_WIDTH) /
                THUMBNAIL_PNG_SCALE,
            heightPx:
                (height ?? THUMBNAIL_PNG_SCALE * GRAPHER_THUMBNAIL_HEIGHT) /
                THUMBNAIL_PNG_SCALE,
            fontSize: fontSize ?? THUMBNAIL_FONT_SIZE,
        }

    const pngWidth = width ?? 850
    const pngHeight = height ?? 600
    const factor = Math.sqrt(DEFAULT_NUM_PIXELS / (pngWidth * pngHeight))
    const heightPx = Math.round(pngHeight * factor)
    return {
        widthPx: Math.round(pngWidth * factor),
        heightPx,
        fontSize:
            fontSize ??
            (heightPx !== 600 ? Math.max(10, heightPx / 25) : undefined),
    }
}

function makeSvgUrl(
    { slug, queryStr, fontSize }: SearchThumbnailTestCase,
    variant: SearchVariant
): string {
    const params = new URLSearchParams(queryStr)
    for (const [key, value] of serializeImageRequest(
        variant.makeRequest(fontSize)
    ))
        params.set(key, value)
    return `/admin/test/search-thumbnails/${slug}.svg?${params}`
}

function makeLivePngUrl(
    { slug, queryStr, fontSize }: SearchThumbnailTestCase,
    variant: SearchVariant
): string {
    const params = new URLSearchParams(queryStr)
    for (const [key, value] of variant.makeLegacyParams(fontSize))
        params.set(key, value)
    return `${LIVE_BASE_URL}/grapher/${slug}.png?${params}`
}

function readVariantParam(value: unknown): GrapherVariant {
    return value === GrapherVariant.Uncaptioned
        ? GrapherVariant.Uncaptioned
        : GrapherVariant.Thumbnail
}

function getVariantLayout(variant: SearchVariant): SvgLayout {
    return resolveSvgLayout(variant.makeRequest(undefined))
}

function SearchThumbnailTestPage({
    sections,
    sectionId,
    sample,
    focus,
    variant,
    scale,
}: {
    sections: SearchThumbnailTestSection[]
    sectionId?: string
    sample?: SampleOptions
    focus?: string
    variant: GrapherVariant
    scale: number
}): React.ReactElement {
    const visibleVariants = SEARCH_VARIANTS.filter(
        (searchVariant) => searchVariant.variant === variant
    )
    const style = SEARCH_VARIANTS.reduce((css, variant) => {
        const { widthPx, heightPx } = getVariantLayout(variant)
        const variantScale = scale * variant.displayScale
        return `${css}
.thumbnail--${variant.id} {
    width: ${widthPx}px;
    height: ${heightPx}px;
    zoom: ${variantScale};
}
.column-heading--${variant.id} {
    width: calc(${widthPx}px * ${variantScale});
}`
    }, PAGE_STYLE)
    return (
        <html>
            <head>
                <meta charSet="utf-8" />
                <title>Test Search Thumbnails</title>
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
                    <select name="variant" defaultValue={variant}>
                        <option value={GrapherVariant.Thumbnail}>
                            simplified
                        </option>
                        <option value={GrapherVariant.Uncaptioned}>
                            uncaptioned
                        </option>
                    </select>
                    <select name="scale" defaultValue={String(scale)}>
                        <option value="0.5">0.5×</option>
                        <option value="1">1×</option>
                        <option value="1.5">1.5×</option>
                        <option value="2">2×</option>
                    </select>
                </form>
                {sections.map((section) => (
                    <section key={section.id} className="section">
                        <h2>{section.title}</h2>
                        <div className="card__thumbnails column-headings">
                            {visibleVariants.map((variant) => (
                                <div key={variant.id} className="pair">
                                    <span
                                        className={`column-heading column-heading--${variant.id}`}
                                    >
                                        {variant.heading} — live
                                    </span>
                                    <span
                                        className={`column-heading column-heading--${variant.id}`}
                                    >
                                        {variant.heading} — local
                                    </span>
                                </div>
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
                                        {visibleVariants.map((variant) => (
                                            <div
                                                key={variant.id}
                                                className="pair"
                                            >
                                                <img
                                                    className={`thumbnail thumbnail--${variant.id}`}
                                                    src={makeLivePngUrl(
                                                        testCase,
                                                        variant
                                                    )}
                                                    loading="lazy"
                                                    alt=""
                                                />
                                                <div
                                                    className={`thumbnail thumbnail--local thumbnail--${variant.id}`}
                                                    data-src={makeSvgUrl(
                                                        testCase,
                                                        variant
                                                    )}
                                                />
                                            </div>
                                        ))}
                                    </a>
                                </figure>
                            ))}
                        </div>
                    </section>
                ))}
                <script dangerouslySetInnerHTML={{ __html: PAGE_SCRIPT }} />
            </body>
        </html>
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
    margin-bottom: 8px;
    color: #6e7581;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    white-space: nowrap;
}

.pair {
    display: flex;
    align-items: flex-start;
    gap: 12px;
}

.card {
    margin: 0;
}

.card__label {
    display: block;
    margin-bottom: 6px;
    font-weight: 700;
}

.card__thumbnails {
    display: flex;
    gap: 32px;
    width: fit-content;
}

.thumbnail {
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
