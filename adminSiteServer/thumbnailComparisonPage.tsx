import { Router } from "express"
import { ChartLabelMode } from "@ourworldindata/types"
import { renderToHtmlPage } from "../serverUtils/serverUtil.js"
import { getPlainRouteWithROTransaction } from "./plainRouterHelpers.js"
import {
    ThumbnailTestCase,
    ThumbnailTestSection,
} from "./thumbnailTestCases.js"
import {
    LABEL_MODES,
    PAGE_SCRIPT,
    THUMBNAIL_SIZES,
    ThumbnailCaseControls,
    ThumbnailCaseSelection,
    ThumbnailSizeControls,
    ThumbnailSizeId,
    findThumbnailTestSections,
    makeLivePngUrl,
    makeLiveUrl,
    makePageStyle,
    makeSeedRedirectUrl,
    makeSvgUrl,
    readCaseSelection,
    readLabelModeParam,
    readScaleParam,
    readSizeParam,
    readStringParam,
} from "./thumbnailTestPage.js"

const DEFAULT_STAGING_ORIGIN = "http://staging-site-thumbnail-test-page"

export function addThumbnailComparisonRoutes(router: Router): void {
    getPlainRouteWithROTransaction(
        router,
        "/thumbnail-comparison",
        async (req, res, trx) => {
            const seedRedirectUrl = makeSeedRedirectUrl(req)
            if (seedRedirectUrl) {
                res.redirect(seedRedirectUrl)
                return
            }
            const selection = readCaseSelection(req)
            const sections = await findThumbnailTestSections(trx, selection)
            res.send(
                renderToHtmlPage(
                    <ThumbnailComparisonPage
                        sections={sections}
                        selection={selection}
                        labelMode={readLabelModeParam(req.query.imLabels)}
                        stagingOrigin={readStagingOrigin(req.query.staging)}
                        scale={readScaleParam(req.query.scale)}
                        sizeId={readSizeParam(req.query.size)}
                    />
                )
            )
        }
    )
}

interface ComparisonOptions {
    labelMode: ChartLabelMode
    stagingOrigin: string
    fontSize: number
}

function ThumbnailComparisonPage({
    sections,
    selection,
    labelMode,
    stagingOrigin,
    scale,
    sizeId,
}: {
    sections: ThumbnailTestSection[]
    selection: ThumbnailCaseSelection
    labelMode: ChartLabelMode
    stagingOrigin: string
    scale: number
    sizeId: ThumbnailSizeId
}): React.ReactElement {
    const options = {
        labelMode,
        stagingOrigin,
        fontSize: THUMBNAIL_SIZES[sizeId].fontSize,
    }
    const style = makePageStyle(scale, sizeId) + EXTRA_STYLE
    return (
        <html>
            <head>
                <meta charSet="utf-8" />
                <title>Thumbnail Comparison</title>
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700&display=swap"
                />
                <style dangerouslySetInnerHTML={{ __html: style }} />
            </head>
            <body>
                <form className="controls" method="get">
                    <select name="imLabels" defaultValue={labelMode}>
                        {LABEL_MODES.map((mode) => (
                            <option key={mode} value={mode}>
                                imLabels={mode}
                            </option>
                        ))}
                    </select>
                    <ThumbnailCaseControls selection={selection} />
                    <label>
                        Staging{" "}
                        <input
                            type="text"
                            name="staging"
                            defaultValue={stagingOrigin}
                        />
                    </label>
                    <ThumbnailSizeControls scale={scale} sizeId={sizeId} />
                </form>
                {sections.map((section) => (
                    <ComparisonSectionView
                        key={section.id}
                        section={section}
                        options={options}
                    />
                ))}
                <script dangerouslySetInnerHTML={{ __html: PAGE_SCRIPT }} />
            </body>
        </html>
    )
}

function ComparisonSectionView({
    section,
    options,
}: {
    section: ThumbnailTestSection
    options: ComparisonOptions
}): React.ReactElement {
    return (
        <section className="section">
            <h2>{section.title}</h2>
            <div className="card__thumbnails column-headings">
                <span className="column-heading">Prod</span>
                <span className="column-heading">Staging</span>
                <span className="column-heading">Local</span>
            </div>
            <div className="grid">
                {section.cases.map((testCase, index) => (
                    <ComparisonCard
                        key={index}
                        testCase={testCase}
                        options={options}
                    />
                ))}
            </div>
        </section>
    )
}

function ComparisonCard({
    testCase,
    options,
}: {
    testCase: ThumbnailTestCase
    options: ComparisonOptions
}): React.ReactElement {
    const prodUrl = makeProdPngUrl(testCase, options)
    const stagingUrl = makeStagingPngUrl(testCase, options)
    const localUrl = makeSvgUrl(testCase, options.labelMode, options.fontSize)
    return (
        <figure className="card">
            <figcaption className="card__label" title={testCase.label}>
                <a href={makeLiveUrl(testCase)} target="_blank" rel="noopener">
                    {testCase.label}
                </a>{" "}
                <span className="card__slug">{testCase.slug}</span>
            </figcaption>
            <div className="card__thumbnails">
                {prodUrl ? (
                    <ImageLink url={prodUrl}>
                        <img
                            className="thumbnail"
                            src={prodUrl}
                            loading="lazy"
                            alt=""
                        />
                    </ImageLink>
                ) : (
                    <div className="thumbnail thumbnail--unavailable">
                        imLabels={options.labelMode} is not available on prod
                    </div>
                )}
                <ImageLink url={stagingUrl}>
                    <img
                        className="thumbnail"
                        src={stagingUrl}
                        loading="lazy"
                        alt=""
                    />
                </ImageLink>
                <ImageLink url={localUrl}>
                    <div
                        className="thumbnail thumbnail--local"
                        data-src={localUrl}
                    />
                </ImageLink>
            </div>
        </figure>
    )
}

function ImageLink({
    url,
    children,
}: {
    url: string
    children: React.ReactNode
}): React.ReactElement {
    return (
        <a href={url} title={url} target="_blank" rel="noopener">
            {children}
        </a>
    )
}

const EXTRA_STYLE = `
.card__slug {
    color: #6e7581;
    font-weight: 400;
}

.thumbnail--unavailable {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 8px;
    box-sizing: border-box;
    color: #6e7581;
    font-size: 12px;
    text-align: center;
    background: repeating-linear-gradient(
        -45deg,
        #fff,
        #fff 8px,
        #f2f2f0 8px,
        #f2f2f0 16px
    );
}
`

function readStagingOrigin(value: unknown): string {
    const origin = readStringParam(value)?.trim().replace(/\/+$/, "")
    if (!origin) return DEFAULT_STAGING_ORIGIN
    return origin.includes("://") ? origin : `http://${origin}`
}

/** Prod's legacy thumbnail URL, or undefined for label modes prod can't render */
function makeProdPngUrl(
    testCase: ThumbnailTestCase,
    { labelMode, fontSize }: ComparisonOptions
): string | undefined {
    if (labelMode === ChartLabelMode.All)
        return makeLivePngUrl(testCase, fontSize)
    if (labelMode === ChartLabelMode.Values)
        return `${makeLivePngUrl(testCase, fontSize)}&imMinimal=1`
    return undefined
}

function makeStagingPngUrl(
    { slug, queryStr }: ThumbnailTestCase,
    { labelMode, stagingOrigin, fontSize }: ComparisonOptions
): string {
    const params = new URLSearchParams(queryStr)
    params.set("imVariant", "simplified")
    params.set("imLabels", labelMode)
    params.set("imFontSize", String(fontSize))
    return `${stagingOrigin}/grapher/${slug}.png?${params}`
}
