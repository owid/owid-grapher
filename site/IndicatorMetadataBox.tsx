import cx from "clsx"
import {
    DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
    SimpleMarkdownText,
    IndicatorSources,
    ExpandableToggle,
    CodeSnippet,
    makeSource,
    IndicatorProcessing,
    INDICATOR_PROCESSING_SECTION_ID,
    MetadataBoxExpander,
    MetadataBoxCollapseButton,
} from "@ourworldindata/components"
import {
    ArchiveContext,
    DataPageDataV2,
    FaqEntryData,
    IndicatorTitleWithFragments,
    LicenseOption,
    OwidEnrichedGdocBlock,
    PrimaryTopic,
} from "@ourworldindata/types"
import { useRef } from "react"
import {
    formatAttributions,
    prepareSourcesForDisplay,
    getIndicatorCitations,
    spansToUnformattedPlainText,
} from "@ourworldindata/utils"
import { Byline } from "./gdocs/components/Byline.js"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"
import { splitDescriptionKey } from "./datapageUtils.js"
import { SiteAnalytics } from "./SiteAnalytics.js"
import { ChartLicenseNotice } from "./ChartLicenseNotice.js"

const analytics = new SiteAnalytics()

// Log expand/collapse of an ExpandableToggle in the metadata box. `target` is a
// codified, English-language identifier (not the rendered label) so the event
// isn't affected by browser/page translation.
function logExpandableToggle(target: string, isOpen: boolean): void {
    analytics.logSiteClick(
        isOpen ? "expand_expandable_toggle" : "collapse_expandable_toggle",
        target
    )
}

interface IndicatorMetadataSectionsProps {
    datapageData: DataPageDataV2
    className?: string
    faqEntries: FaqEntryData | undefined
    detailsRef: React.RefObject<HTMLDetailsElement | null>
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
    primaryTopic?: PrimaryTopic
    title: IndicatorTitleWithFragments
    descriptionProcessing: string | undefined
    license?: LicenseOption
}

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

function IndicatorMetadataSections({
    datapageData,
    className,
    faqEntries,
    detailsRef,
    canonicalUrl,
    archiveContext,
    primaryTopic,
    title,
    descriptionProcessing,
    license,
}: IndicatorMetadataSectionsProps) {
    const { origins, source } = datapageData
    const sourcesForDisplay = prepareSourcesForDisplay({
        origins,
        source,
    })

    const citationUrl = archiveContext?.archiveUrl ?? canonicalUrl
    const {
        short: citationShort,
        long: citationLong,
        datapage: citationDatapage,
    } = getIndicatorCitations({
        indicatorTitle: title,
        origins,
        source,
        attributions: datapageData.attributions,
        attributionShort: datapageData.attributionShort,
        titleVariant: datapageData.titleVariant,
        owidProcessingLevel: datapageData.owidProcessingLevel,
        citationUrl,
        archivalDate: archiveContext?.archivalDate,
        primaryTopic,
    })

    const faqQuestions = groupFaqsByQuestion(faqEntries?.faqs ?? [])

    // Only the start of a long descriptionKey is shown above the fold; the
    // rest goes inside the <details> so that it works without JavaScript and
    // browsers auto-expand it when in-page search matches hidden text.
    const { preview: descriptionKeyPreview, remainder: descriptionKeyRest } =
        splitDescriptionKey(datapageData.descriptionKey ?? "")

    return (
        <MetadataBoxExpander
            className={className}
            detailsRef={detailsRef}
            preview={
                descriptionKeyPreview ? (
                    <SimpleMarkdownText text={descriptionKeyPreview} />
                ) : undefined
            }
            onToggle={(isOpen) =>
                analytics.logSiteClick(
                    isOpen ? "expand_metadata_box" : "collapse_metadata_box"
                )
            }
        >
            {descriptionKeyRest && (
                <div className="metadata-box-expander__remainder metadata-box-expander__prose">
                    <SimpleMarkdownText text={descriptionKeyRest} />
                </div>
            )}
            {
                <section className="metadata-box-section metadata-box-section--faqs">
                    <h2 className="metadata-box-section__title" id="faqs">
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
                            onToggle={(isOpen) =>
                                logExpandableToggle(
                                    // untranslated source text
                                    faq.question.slice(0, 100),
                                    isOpen
                                )
                            }
                        />
                    ))}
                    <ExpandableToggle
                        label="How did Our World in Data process this data?"
                        contentId={INDICATOR_PROCESSING_SECTION_ID}
                        content={
                            <IndicatorProcessing
                                descriptionProcessing={descriptionProcessing}
                            />
                        }
                        onToggle={(isOpen) =>
                            logExpandableToggle(
                                "how_owid_processed_data",
                                isOpen
                            )
                        }
                    />
                </section>
            }
            {datapageData.descriptionFromProducer && (
                <section className="metadata-box-section">
                    <h2 className="metadata-box-section__title">
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
                        onToggle={(isOpen) =>
                            logExpandableToggle(
                                "producer_documentation",
                                isOpen
                            )
                        }
                    />
                </section>
            )}
            <section className="metadata-box-section">
                <h2
                    id={DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}
                    className="metadata-box-section__title"
                >
                    Data sources
                </h2>
                <IndicatorSources
                    sources={sourcesForDisplay}
                    hideReuseThisWorkText
                    hideTeasers
                    onSourceToggle={(_source, index, isOpen) =>
                        logExpandableToggle(`data_source_${index + 1}`, isOpen)
                    }
                />
            </section>
            {(citationShort || citationLong) && (
                <section className="metadata-box-section">
                    <h2 className="metadata-box-section__title">How to cite</h2>
                    {citationDatapage && (
                        <ExpandableToggle
                            label="How to cite this page"
                            isStacked
                            content={
                                <>
                                    <p>
                                        To cite this page overall, including any
                                        descriptions, FAQs or explanations of
                                        the data authored by Our World in Data,
                                        please use the following citation:
                                    </p>
                                    <CodeSnippet
                                        code={citationDatapage}
                                        theme="light"
                                        useMarkdown={true}
                                        onCopy={() =>
                                            analytics.logSiteClick(
                                                "copy_citation",
                                                "citation_page"
                                            )
                                        }
                                    />
                                </>
                            }
                            onToggle={(isOpen) =>
                                logExpandableToggle("how_to_cite_page", isOpen)
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
                                            If you have limited space (e.g. in
                                            data visualizations), you can use
                                            this abbreviated in-line citation:
                                        </p>
                                        <CodeSnippet
                                            code={citationShort}
                                            theme="light"
                                            useMarkdown={true}
                                            onCopy={() =>
                                                analytics.logSiteClick(
                                                    "copy_citation",
                                                    "citation_data_short"
                                                )
                                            }
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
                                                    onCopy={() =>
                                                        analytics.logSiteClick(
                                                            "copy_citation",
                                                            "citation_data_full"
                                                        )
                                                    }
                                                />
                                            </>
                                        )}
                                    </>
                                }
                                onToggle={(isOpen) =>
                                    logExpandableToggle(
                                        "how_to_cite_data",
                                        isOpen
                                    )
                                }
                            />
                        )}
                    </section>
                </section>
            )}
            <section className="metadata-box-section indicator-metadata-box__reuse-notice">
                <p>
                    All data produced by third-party providers and made
                    available by Our World in Data are subject to the license
                    terms from the original providers. Our work would not be
                    possible without the data providers we rely on, so we ask
                    you to always cite them appropriately. This is crucial to
                    allow data providers to continue doing their work,
                    enhancing, maintaining and updating valuable data.
                </p>
                <p>
                    <ChartLicenseNotice license={license} />
                </p>
            </section>
        </MetadataBoxExpander>
    )
}

export default function IndicatorMetadataBox({
    datapageData,
    faqEntries,
    className,
    id,
    canonicalUrl,
    archiveContext,
    license,
}: {
    datapageData: DataPageDataV2
    className?: string
    id?: string
    faqEntries: FaqEntryData | undefined
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
    license?: LicenseOption
}) {
    // Owners of the dataset backing this indicator. For now we show a single
    // indicator's owners; multi-indicator charts will get a separate metadata
    // expander per indicator, so we don't merge owners across datasets here.
    const owners = datapageData.owners?.[0]?.owners ?? []

    const attribution = formatAttributions(datapageData.attributions ?? [])
    const sourceString = makeSource({
        attribution,
        owidProcessingLevel: datapageData.owidProcessingLevel,
        processingId: INDICATOR_PROCESSING_SECTION_ID,
    })

    const detailsRef = useRef<HTMLDetailsElement | null>(null)

    return (
        <div
            className={cx("metadata-box indicator-metadata-box", className)}
            id={id}
        >
            <MetadataBoxCollapseButton detailsRef={detailsRef} />
            <h2 className="indicator-metadata-box__title body-2-bold-tight">
                {datapageData.title.title}
                <span className="indicator-metadata-box__title-variant">
                    {datapageData.titleVariant}
                </span>
            </h2>
            <dl className="metadata-box-key-data">
                {datapageData.descriptionShort && (
                    <div className="metadata-box-key-data__row metadata-box-key-data__row--full-width">
                        <dt className="sr-only">Description</dt>
                        <dd className="metadata-box-key-data__value">
                            <SimpleMarkdownText
                                text={datapageData.descriptionShort}
                            />
                        </dd>
                    </div>
                )}
                {sourceString && (
                    <div className="metadata-box-key-data__row metadata-box-key-data__row--full-width">
                        <dt className="metadata-box-key-data__key metadata-box-key-data__key--source">
                            Data source
                        </dt>
                        <dd className="metadata-box-key-data__value">
                            {sourceString}
                        </dd>
                    </div>
                )}
                {datapageData.unit && (
                    <div className="metadata-box-key-data__row">
                        <dt className="metadata-box-key-data__key">Unit</dt>
                        <dd className="metadata-box-key-data__value">
                            {datapageData.unit}
                        </dd>
                    </div>
                )}
                {datapageData.dateRange && (
                    <div className="metadata-box-key-data__row">
                        <dt className="metadata-box-key-data__key">
                            Date range
                        </dt>
                        <dd className="metadata-box-key-data__value">
                            {datapageData.dateRange}
                        </dd>
                    </div>
                )}
                {datapageData.lastUpdated && (
                    <div className="metadata-box-key-data__row">
                        <dt className="metadata-box-key-data__key">
                            Last updated
                        </dt>
                        <dd className="metadata-box-key-data__value">
                            {datapageData.lastUpdated}
                        </dd>
                    </div>
                )}
                {datapageData.nextUpdate && (
                    <div className="metadata-box-key-data__row">
                        <dt className="metadata-box-key-data__key">
                            Next expected update
                        </dt>
                        <dd className="metadata-box-key-data__value">
                            {datapageData.nextUpdate}
                        </dd>
                    </div>
                )}
                {owners.length > 0 && (
                    <div className="metadata-box-key-data__row">
                        <dt className="metadata-box-key-data__key">
                            Managed by
                        </dt>
                        <dd className="metadata-box-key-data__value">
                            <Byline names={owners} prefix="" />
                        </dd>
                    </div>
                )}
            </dl>
            <IndicatorMetadataSections
                datapageData={datapageData}
                faqEntries={faqEntries}
                detailsRef={detailsRef}
                canonicalUrl={canonicalUrl}
                archiveContext={archiveContext}
                primaryTopic={datapageData.primaryTopic}
                title={datapageData.title}
                descriptionProcessing={datapageData.descriptionProcessing}
                license={license}
            />
        </div>
    )
}
