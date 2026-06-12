import cx from "clsx"
import {
    DATAPAGE_ABOUT_THIS_DATA_SECTION_ID,
    SimpleMarkdownText,
    IndicatorSources,
    ExpandableToggle,
    CodeSnippet,
} from "@ourworldindata/components"
import {
    ArchiveContext,
    DataPageDataV2,
    Distribution,
    FaqEntryData,
    GrapherInterface,
} from "@ourworldindata/types"
import { useMemo, useRef } from "react"
import {
    prepareSourcesForDisplay,
    getCitationShort,
    getCitationLong,
} from "@ourworldindata/utils"
import { DownloadSectionProps } from "./DownloadSection.js"
import { BAKED_GRAPHER_URL } from "../settings/clientSettings.js"
import { useWindowQueryParams } from "./hooks.js"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChevronUp } from "@fortawesome/free-solid-svg-icons"

interface ExpandableSectionProps {
    datapageData: DataPageDataV2
    className?: string
    faqEntries: FaqEntryData | undefined
    downloadProps: DownloadSectionProps | undefined
    detailsRef: React.RefObject<HTMLDetailsElement | null>
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
}

const KEY_DESCRIPTION_PREVIEW_COUNT = 3

function ExpandableSection({
    datapageData,
    className,
    faqEntries,
    detailsRef,
    canonicalUrl,
    archiveContext,
}: ExpandableSectionProps) {
    const { origins, source } = datapageData
    const preview = datapageData.descriptionKey.slice(
        0,
        KEY_DESCRIPTION_PREVIEW_COUNT
    )
    const remainder = datapageData.descriptionKey.slice(
        KEY_DESCRIPTION_PREVIEW_COUNT
    )
    const sourcesForDisplay = prepareSourcesForDisplay({
        origins,
        source,
    })

    const citationUrl = archiveContext?.archiveUrl ?? canonicalUrl
    const citationShort = getCitationShort(
        origins,
        datapageData.attributions,
        datapageData.owidProcessingLevel
    )
    const citationLong = getCitationLong(
        datapageData.title,
        origins,
        source,
        datapageData.attributions,
        datapageData.attributionShort,
        datapageData.titleVariant,
        datapageData.owidProcessingLevel,
        citationUrl,
        archiveContext?.archivalDate
    )

    return (
        <div className={cx("meta-expander", className)}>
            <ul className="meta-expander__list meta-expander__preview">
                {preview.map((p) => (
                    <li className="meta-expander__list-item" key={p}>
                        <SimpleMarkdownText text={p} />
                    </li>
                ))}
            </ul>
            <details ref={detailsRef}>
                <summary className="meta-expander__summary">
                    <span className="meta-expander__show-more">Show more</span>
                    <span className="meta-expander__show-less">Show less</span>
                </summary>
                <ul className="meta-expander__list">
                    {remainder.map((p) => (
                        <li key={p}>
                            <SimpleMarkdownText text={p} />
                        </li>
                    ))}
                </ul>
                <section>
                    <h2 className="meta-expander__data-sources-title body-2-bold-tight">
                        Data sources
                    </h2>
                    <IndicatorSources
                        sources={sourcesForDisplay}
                        hideReuseThisWorkText
                        hideTeasers
                    />
                </section>
                {(citationShort || citationLong) && (
                    <section>
                        <h2 className="meta-expander__citations-title body-2-bold-tight">
                            Citations
                        </h2>
                        <div className="indicator-sources">
                            {citationShort && (
                                <ExpandableToggle
                                    label="How should I cite this data in a news article?"
                                    isStacked={!!citationLong}
                                    content={
                                        <>
                                            <p className="citation__paragraph">
                                                If you have limited space (e.g.
                                                in data visualizations), you can
                                                use this abbreviated in-line
                                                citation:
                                            </p>
                                            <CodeSnippet
                                                code={citationShort}
                                                theme="light"
                                                useMarkdown={true}
                                            />
                                        </>
                                    }
                                />
                            )}
                            {citationLong && (
                                <ExpandableToggle
                                    label="How should I cite this in an academic article or report?"
                                    content={
                                        <CodeSnippet
                                            code={citationLong}
                                            theme="light"
                                            useMarkdown={true}
                                        />
                                    }
                                />
                            )}
                        </div>
                    </section>
                )}
                <section className="meta-expander__reuse-notice">
                    <p>
                        All data produced by third-party providers and made
                        available by Our World in Data are subject to the
                        license terms from the original providers. Our work
                        would not be possible without the data providers we rely
                        on, so we ask you to always cite them appropriately.
                        This is crucial to allow data providers to continue
                        doing their work, enhancing, maintaining and updating
                        valuable data.
                    </p>
                    <p>
                        All data, visualizations, and code produced by Our World
                        in Data are completely open access under the{" "}
                        <a href="https://creativecommons.org/licenses/by/4.0/">
                            Creative Commons BY license
                        </a>
                        . You have the permission to use, distribute, and
                        reproduce these in any medium, provided the source and
                        authors are credited.
                    </p>
                </section>
                <section>
                    {!!faqEntries?.faqs.length && (
                        <div className="section-wrapper section-wrapper__faqs grid">
                            <h2
                                className="metadata-section__title span-cols-2 span-lg-cols-3 col-md-start-2 span-md-cols-10 col-sm-start-1 span-sm-cols-12"
                                id="faqs"
                            >
                                Frequently Asked Questions
                            </h2>
                            <div className="faqs__items grid grid-cols-10 grid-lg-cols-9 grid-md-cols-12 span-cols-10 span-lg-cols-9 span-md-cols-12 span-sm-cols-12">
                                <ArticleBlocks
                                    blocks={faqEntries.faqs}
                                    containerType="datapage"
                                />
                            </div>
                        </div>
                    )}
                </section>
            </details>
        </div>
    )
}

export default function AboutThisDataV2({
    datapageData,
    faqEntries,
    className,
    id,
    grapherConfig,
    distribution,
    canonicalUrl,
    archiveContext,
}: {
    datapageData: DataPageDataV2
    grapherConfig: GrapherInterface
    className?: string
    id?: string
    faqEntries: FaqEntryData | undefined
    distribution: Distribution
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
}) {
    const hasDescriptionKey =
        datapageData.descriptionKey && datapageData.descriptionKey.length > 0

    const detailsRef = useRef<HTMLDetailsElement | null>(null)

    const slug = grapherConfig.slug
    const reactiveQueryStr = useWindowQueryParams()
    const downloadProps: DownloadSectionProps | undefined = useMemo(() => {
        if (!slug) return undefined

        // Note: yColumns is not passed here, which means the short column names
        // option won't be visible in the download section on data pages.
        //
        // To enable this feature on data pages, we would need to:
        // 1. Load variable metadata on the server to get column definitions with shortName
        // 2. Pass that data through to this component (similar to how datapageData is passed)
        // 3. Extract yColumns from the variable metadata and pass them here
        //
        // Without yColumns, users can still download data via the API URLs shown
        // in the "Data API" section, where they can manually add
        // &useColumnShortNames=true
        return {
            slug,
            baseUrl: `${BAKED_GRAPHER_URL}/${slug}`,
            searchParams: new URLSearchParams(reactiveQueryStr),
            distribution,
        }
    }, [distribution, reactiveQueryStr, slug])

    const id_ = id ?? DATAPAGE_ABOUT_THIS_DATA_SECTION_ID
    return (
        <div className={cx("about-this-data-v2", className)} id={id_}>
            <button
                type="button"
                className="about-this-data__show-less"
                onClick={() => {
                    if (detailsRef.current) detailsRef.current.open = false
                }}
            >
                Show less
                <FontAwesomeIcon
                    icon={faChevronUp}
                    className="about-this-data__show-less-icon"
                />
            </button>
            <h2 className="about-this-data__indicator-title body-2-bold-tight ">
                {datapageData.title.title}
                <span className="about-this-data__title-variant">
                    {datapageData.titleVariant}
                </span>
            </h2>
            <dl className="meta-description-table">
                {datapageData.descriptionShort && (
                    <>
                        <dd className="meta-description-table__value">
                            <SimpleMarkdownText
                                text={datapageData.descriptionShort}
                            />
                        </dd>
                    </>
                )}
                {datapageData.attributionShort && (
                    <>
                        <dt
                            className="meta-description-table__key"
                            style={{ marginTop: 8 }}
                        >
                            Data source
                        </dt>
                        <dd className="meta-description-table__value">
                            <SimpleMarkdownText
                                text={datapageData.attributionShort}
                            />
                        </dd>
                    </>
                )}
                <div className="meta-description-table__secondary-values">
                    {datapageData.unit && (
                        <span className="meta-description-table__pair">
                            <dt className="meta-description-table__key">
                                Unit
                            </dt>
                            <dd className="meta-description-table__value">
                                {datapageData.unit}
                            </dd>
                        </span>
                    )}
                    {datapageData.lastUpdated && (
                        <span className="meta-description-table__pair">
                            <dt className="meta-description-table__key">
                                Last updated
                            </dt>
                            <dd className="meta-description-table__value">
                                {datapageData.lastUpdated}
                            </dd>
                        </span>
                    )}
                    {datapageData.nextUpdate && (
                        <span className="meta-description-table__pair">
                            <dt className="meta-description-table__key">
                                Next expected update
                            </dt>
                            <dd className="meta-description-table__value">
                                {datapageData.nextUpdate}
                            </dd>
                        </span>
                    )}
                </div>
            </dl>
            {hasDescriptionKey && (
                <ExpandableSection
                    datapageData={datapageData}
                    faqEntries={faqEntries}
                    downloadProps={downloadProps}
                    detailsRef={detailsRef}
                    canonicalUrl={canonicalUrl}
                    archiveContext={archiveContext}
                />
            )}
        </div>
    )
}
