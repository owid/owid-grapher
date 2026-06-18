import cx from "classnames"
import * as _ from "lodash-es"
import {
    DATAPAGE_ABOUT_THIS_DATA_SECTION_ID,
    DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
    SimpleMarkdownText,
    IndicatorSources,
    ExpandableToggle,
    CodeSnippet,
    makeSource,
    IndicatorProcessing,
    INDICATOR_PROCESSING_SECTION_ID,
} from "@ourworldindata/components"
import {
    ArchiveContext,
    DataPageDataV2,
    FaqEntryData,
    IndicatorTitleWithFragments,
    OwidEnrichedGdocBlock,
    PrimaryTopic,
} from "@ourworldindata/types"
import { useRef } from "react"
import {
    prepareSourcesForDisplay,
    getCitationShort,
    getCitationLong,
    spansToUnformattedPlainText,
    excludeUndefined,
    getPhraseForArchivalDate,
} from "@ourworldindata/utils"
import { Byline } from "./gdocs/components/Byline.js"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons"
import { getAttributionUnshortened } from "./datapageUtils.js"
import dayjs from "dayjs"

interface ExpandableSectionProps {
    datapageData: DataPageDataV2
    className?: string
    faqEntries: FaqEntryData | undefined
    detailsRef: React.RefObject<HTMLDetailsElement | null>
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
    primaryTopic?: PrimaryTopic
    title: IndicatorTitleWithFragments
    descriptionProcessing: string | undefined
}

const KEY_DESCRIPTION_PREVIEW_COUNT = 3

// FAQs arrive as a flat block list — each question is a heading followed by its
// answer blocks. Split on headings so each question can render as its own toggle.
function groupFaqsByQuestion(
    blocks: OwidEnrichedGdocBlock[]
): { question: string; answer: OwidEnrichedGdocBlock[] }[] {
    const questions: {
        question: string
        answer: OwidEnrichedGdocBlock[]
    }[] = []
    for (const block of blocks) {
        if (block.type === "heading") {
            questions.push({
                question: spansToUnformattedPlainText(block.text),
                answer: [],
            })
        } else if (questions.length > 0) {
            const answer = questions[questions.length - 1].answer
            if (block.type === "expandable-paragraph") {
                // Flatten expandable paragraphs into the main answer, since the question is already hidden behind a toggle.
                answer.push(...block.items)
            } else {
                answer.push(block)
            }
        }
    }
    return questions
}

function ExpandableSection({
    datapageData,
    className,
    faqEntries,
    detailsRef,
    canonicalUrl,
    archiveContext,
    primaryTopic,
    title,
    descriptionProcessing,
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
    const currentYear = dayjs().year()
    const producers = _.uniq(origins.map((o) => `${o.producer}`))
    const adaptedFrom =
        producers.length > 0 ? producers.join(", ") : source?.name
    const maybeAddPeriod = (s: string) =>
        s.endsWith("?") || s.endsWith(".") ? s : `${s}.`
    // For the citation of the data page add a period it doesn't have that or a question mark
    const primaryTopicCitation = maybeAddPeriod(primaryTopic?.citation ?? "")
    const archivalString = getPhraseForArchivalDate(
        archiveContext?.archivalDate
    )
    const citationDatapage = excludeUndefined([
        primaryTopic
            ? `“Data Page: ${title.title}”, part of the following publication: ${primaryTopicCitation}`
            : `“Data Page: ${title.title}”. Our World in Data (${currentYear}).`,
        adaptedFrom ? `Data adapted from ${adaptedFrom}.` : undefined,
        `Retrieved from ${citationUrl} [online resource]${
            archivalString ? ` ${archivalString}` : ""
        }`,
    ]).join(" ")

    const faqQuestions = groupFaqsByQuestion(faqEntries?.faqs ?? [])

    // The "Show less" summary sits at the bottom of the expanded content (it has
    // order: 1 in the flex column), so collapsing removes a large chunk of height
    // above the control. With scroll anchoring disabled on the datapage, the
    // viewport would stay put and "Show more" would jump upwards. To keep it
    // under the cursor, we collapse the details ourselves and scroll by however
    // far the summary moved. (The top-right "Show less" button closes the details
    // directly, bypassing this, which is intended — pinning only matters here.)
    const summaryRef = useRef<HTMLElement>(null)
    const handleSummaryClick = (event: React.MouseEvent<HTMLElement>) => {
        const details = detailsRef.current
        const summary = summaryRef.current
        if (!details?.open || !summary) return // expanding — let the native toggle run
        event.preventDefault()
        const before = summary.getBoundingClientRect().top
        details.open = false
        const after = summary.getBoundingClientRect().top
        window.scrollBy(0, after - before)
    }

    return (
        <div className={cx("meta-expander", className)}>
            {preview.length > 0 && (
                <ul className="meta-expander__list meta-expander__preview">
                    {preview.map((p) => (
                        <li className="meta-expander__list-item" key={p}>
                            <SimpleMarkdownText text={p} />
                        </li>
                    ))}
                </ul>
            )}
            <details className="meta-expander__details" ref={detailsRef}>
                <summary
                    className="meta-expander__summary"
                    ref={summaryRef}
                    onClick={handleSummaryClick}
                >
                    <span className="meta-expander__show-more">
                        Show more{" "}
                        <FontAwesomeIcon
                            className="indicator-metadata-box__chevron"
                            icon={faChevronDown}
                        />
                    </span>
                    <span className="meta-expander__show-less">
                        Show less{" "}
                        <FontAwesomeIcon
                            className="indicator-metadata-box__chevron"
                            icon={faChevronUp}
                        />
                    </span>
                </summary>
                {remainder.length > 0 && (
                    <ul className="meta-expander__list">
                        {remainder.map((p) => (
                            <li className="meta-expander__list-item" key={p}>
                                <SimpleMarkdownText text={p} />
                            </li>
                        ))}
                    </ul>
                )}
                {
                    <section className="meta-expander__section meta-expander__section--faqs">
                        <h2 className="meta-expander__section-title" id="faqs">
                            Frequently asked questions
                        </h2>
                        {faqQuestions.map((faq, i) => (
                            <ExpandableToggle
                                key={faq.question}
                                label={faq.question}
                                isStacked={i < faqQuestions.length - 1}
                                content={
                                    <ArticleBlocks
                                        blocks={faq.answer}
                                        containerType="datapage"
                                    />
                                }
                            />
                        ))}
                        <ExpandableToggle
                            label="How did Our World in Data process this data?"
                            contentId={INDICATOR_PROCESSING_SECTION_ID}
                            content={
                                <IndicatorProcessing
                                    descriptionProcessing={
                                        descriptionProcessing
                                    }
                                />
                            }
                        />
                    </section>
                }
                {datapageData.descriptionFromProducer && (
                    <section className="meta-expander__section">
                        <h2 className="meta-expander__section-title">
                            Documentation from data sources
                        </h2>
                        <ExpandableToggle
                            label={
                                datapageData.attributionShort ||
                                "Principal data source"
                            }
                            content={
                                <SimpleMarkdownText
                                    text={datapageData.descriptionFromProducer}
                                />
                            }
                        />
                    </section>
                )}
                <section className="meta-expander__section">
                    <h2
                        id={DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}
                        className="meta-expander__section-title"
                    >
                        Data sources
                    </h2>
                    <IndicatorSources
                        sources={sourcesForDisplay}
                        hideReuseThisWorkText
                        hideTeasers
                    />
                </section>
                {(citationShort || citationLong) && (
                    <section className="meta-expander__section">
                        <h2 className="meta-expander__section-title">
                            How to cite
                        </h2>
                        {citationDatapage && (
                            <ExpandableToggle
                                label="How to cite this page"
                                isStacked
                                content={
                                    <>
                                        <p>
                                            To cite this page overall, including
                                            any descriptions, FAQs or
                                            explanations of the data authored by
                                            Our World in Data, please use the
                                            following citation:
                                        </p>
                                        <CodeSnippet
                                            code={citationDatapage}
                                            theme="light"
                                            useMarkdown={true}
                                        />
                                    </>
                                }
                            />
                        )}
                        <section className="indicator-sources">
                            {citationShort && (
                                <ExpandableToggle
                                    label="How to cite this data"
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
                                            {citationLong && (
                                                <>
                                                    <p className="citation__paragraph">
                                                        Full citation
                                                    </p>
                                                    <CodeSnippet
                                                        code={citationLong}
                                                        theme="light"
                                                        useMarkdown={true}
                                                    />
                                                </>
                                            )}
                                        </>
                                    }
                                />
                            )}
                        </section>
                    </section>
                )}
                <section className="meta-expander__section meta-expander__reuse-notice">
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
            </details>
        </div>
    )
}

export default function IndicatorMetadataBox({
    datapageData,
    faqEntries,
    className,
    id,
    canonicalUrl,
    archiveContext,
}: {
    datapageData: DataPageDataV2
    className?: string
    id?: string
    faqEntries: FaqEntryData | undefined
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
}) {
    // Owners of the dataset backing this indicator. For now we show a single
    // indicator's owners; multi-indicator charts will get a separate metadata
    // expander per indicator, so we don't merge owners across datasets here.
    const owners = datapageData.owners?.[0]?.owners ?? []

    const attributionUnshortened = getAttributionUnshortened(datapageData)
    const sourceString = makeSource({
        attribution: attributionUnshortened,
        owidProcessingLevel: datapageData.owidProcessingLevel,
        processingId: INDICATOR_PROCESSING_SECTION_ID,
    })

    const detailsRef = useRef<HTMLDetailsElement | null>(null)

    const id_ = id ?? DATAPAGE_ABOUT_THIS_DATA_SECTION_ID
    return (
        <div className={cx("indicator-metadata-box", className)} id={id_}>
            <button
                type="button"
                className="indicator-metadata-box__show-less"
                onClick={() => {
                    if (detailsRef.current) detailsRef.current.open = false
                }}
            >
                Show less
                <FontAwesomeIcon
                    icon={faChevronUp}
                    className="indicator-metadata-box__chevron"
                />
            </button>
            <h2 className="indicator-metadata-box__indicator-title body-2-bold-tight">
                {datapageData.title.title}
                <span className="indicator-metadata-box__title-variant">
                    {datapageData.titleVariant}
                </span>
            </h2>
            <dl className="meta-description-table">
                {datapageData.descriptionShort && (
                    <div className="meta-description-table__pair meta-description-table__pair--full-width">
                        <dt className="sr-only">Description</dt>
                        <dd className="meta-description-table__value">
                            <SimpleMarkdownText
                                text={datapageData.descriptionShort}
                            />
                        </dd>
                    </div>
                )}
                {sourceString && (
                    <div className="meta-description-table__pair meta-description-table__pair--full-width">
                        <dt className="meta-description-table__key meta-description-table__key--source">
                            Data source
                        </dt>
                        <dd className="meta-description-table__value">
                            {sourceString}
                        </dd>
                    </div>
                )}
                {datapageData.unit && (
                    <div className="meta-description-table__pair">
                        <dt className="meta-description-table__key">Unit</dt>
                        <dd className="meta-description-table__value">
                            {datapageData.unit}
                        </dd>
                    </div>
                )}
                {datapageData.dateRange && (
                    <div className="meta-description-table__pair">
                        <dt className="meta-description-table__key">
                            Date range
                        </dt>
                        <dd className="meta-description-table__value">
                            {datapageData.dateRange}
                        </dd>
                    </div>
                )}
                {datapageData.lastUpdated && (
                    <div className="meta-description-table__pair">
                        <dt className="meta-description-table__key">
                            Last updated
                        </dt>
                        <dd className="meta-description-table__value">
                            {datapageData.lastUpdated}
                        </dd>
                    </div>
                )}
                {datapageData.nextUpdate && (
                    <div className="meta-description-table__pair">
                        <dt className="meta-description-table__key">
                            Next expected update
                        </dt>
                        <dd className="meta-description-table__value">
                            {datapageData.nextUpdate}
                        </dd>
                    </div>
                )}
                {owners.length > 0 && (
                    <div className="meta-description-table__pair">
                        <dt className="meta-description-table__key">
                            Managed by
                        </dt>
                        <dd className="meta-description-table__value">
                            <Byline names={owners} prefix="" />
                        </dd>
                    </div>
                )}
            </dl>
            <ExpandableSection
                datapageData={datapageData}
                faqEntries={faqEntries}
                detailsRef={detailsRef}
                canonicalUrl={canonicalUrl}
                archiveContext={archiveContext}
                title={datapageData.title}
                descriptionProcessing={datapageData.descriptionProcessing}
            />
        </div>
    )
}
