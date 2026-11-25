import cx from "clsx"
import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons"
import {
    DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
    SimpleMarkdownText,
    IndicatorSources,
    ExpandableToggle,
    CodeSnippet,
    makeSource,
    INDICATOR_PROCESSING_SECTION_ID,
    MetadataBoxExpander,
    MetadataBoxToggleButton,
    MetadataBoxSection,
    MetadataBoxKeyData,
    MetadataBoxKeyDataRow,
    MetadataBoxReuseNotice,
    ChartLicenseNotice,
    makeDateRange,
    makeDateRangeLabel,
    makeLastUpdated,
    makeNextUpdate,
    getHeadingId,
} from "@ourworldindata/components"
import {
    ArchiveContext,
    DataPageDataV2,
    FaqEntryData,
    LicenseOption,
    OwidEnrichedGdocBlock,
} from "@ourworldindata/types"
import { useEffect, useRef } from "react"
import {
    formatAttributions,
    prepareSourcesForDisplay,
    getIndicatorCitations,
    spansToUnformattedPlainText,
} from "@ourworldindata/utils"
import AvatarByline from "./gdocs/components/AvatarByline.js"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"
import { getProducerDocsLabel, splitDescriptionKey } from "./datapageUtils.js"
import { SiteAnalytics } from "./SiteAnalytics.js"

const analytics = new SiteAnalytics()

interface FaqQuestion {
    id: string
    question: string
    answer: OwidEnrichedGdocBlock[]
}

// FAQs arrive as a flat block list — each question is a heading followed by its
// answer blocks. Split on headings so each question can render as its own toggle.
function groupFaqsByQuestion(blocks: OwidEnrichedGdocBlock[]): FaqQuestion[] {
    const questions: FaqQuestion[] = []
    for (const block of blocks) {
        if (block.type === "heading") {
            questions.push({
                // Same ids as ArticleBlock, so links to the old layout still work
                id: getHeadingId(block),
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

// Not every supported browser opens closed <details> for a link into them.
function revealMetadataTarget(root: Element, hash: string): HTMLElement | null {
    if (!hash.startsWith("#")) return null
    let id: string
    try {
        id = decodeURIComponent(hash.slice(1))
    } catch {
        return null
    }
    const target = document.getElementById(id)
    if (!target || !root.contains(target)) return null
    let details = target.closest("details")
    while (details && root.contains(details)) {
        details.open = true
        details = details.parentElement?.closest("details") ?? null
    }
    return target
}

// For links to the fragment already in the URL, which fire no hashchange
function openDetailsAroundLinkTarget(event: React.MouseEvent): void {
    const link = (event.target as Element).closest("a")
    const href = link?.getAttribute("href")
    if (href) revealMetadataTarget(event.currentTarget, href)
}

function IndicatorDataDetails({
    datapageData,
}: {
    datapageData: DataPageDataV2
}): React.ReactElement | null {
    const { unit, dateRange, lastUpdated, nextUpdate } = datapageData
    const formattedDateRange = makeDateRange({ dateRange })
    if (!unit && !formattedDateRange && !lastUpdated && !nextUpdate) return null
    return (
        <MetadataBoxSection
            title="Data details"
            className="indicator-metadata-box__data-details"
        >
            <MetadataBoxKeyData>
                {unit && (
                    <MetadataBoxKeyDataRow label="Unit">
                        {unit}
                    </MetadataBoxKeyDataRow>
                )}
                {formattedDateRange && (
                    <MetadataBoxKeyDataRow
                        label={makeDateRangeLabel({ dateRange })}
                    >
                        {formattedDateRange}
                    </MetadataBoxKeyDataRow>
                )}
                {lastUpdated && (
                    <MetadataBoxKeyDataRow label="Last updated">
                        {makeLastUpdated({ lastUpdated })}
                    </MetadataBoxKeyDataRow>
                )}
                {nextUpdate && (
                    <MetadataBoxKeyDataRow label="Next expected update">
                        {makeNextUpdate({ nextUpdate })}
                    </MetadataBoxKeyDataRow>
                )}
            </MetadataBoxKeyData>
        </MetadataBoxSection>
    )
}

function IndicatorFaqs({
    descriptionProcessing,
    faqEntries,
}: {
    descriptionProcessing: string | undefined
    faqEntries: FaqEntryData | undefined
}): React.ReactElement | null {
    const faqQuestions = groupFaqsByQuestion(faqEntries?.faqs ?? [])
    if (!descriptionProcessing && faqQuestions.length === 0) return null

    return (
        <MetadataBoxSection
            title="Frequently asked questions"
            id="faqs"
            className="metadata-box-section--faqs"
        >
            {descriptionProcessing && (
                <ExpandableToggle
                    label="How did Our World in Data process this data?"
                    contentId={INDICATOR_PROCESSING_SECTION_ID}
                    content={
                        <div className="indicator-metadata-box__processing-notes">
                            <SimpleMarkdownText
                                text={descriptionProcessing}
                                dataTrackNote="processing_link"
                                dodTrackNote="processing"
                            />
                        </div>
                    }
                    onToggle={(isOpen) =>
                        analytics.logExpandableToggle(
                            "how_owid_processed_data",
                            isOpen
                        )
                    }
                />
            )}
            {faqQuestions.map((faq) => (
                <ExpandableToggle
                    key={faq.question}
                    label={faq.question}
                    titleId={faq.id}
                    content={
                        <ArticleBlocks
                            blocks={faq.answer}
                            containerType="datapage"
                        />
                    }
                    onToggle={(isOpen) =>
                        analytics.logExpandableToggle(
                            // untranslated source text
                            faq.question.slice(0, 100),
                            isOpen
                        )
                    }
                />
            ))}
        </MetadataBoxSection>
    )
}

function IndicatorProducerDocs({
    datapageData,
}: {
    datapageData: DataPageDataV2
}): React.ReactElement | null {
    if (!datapageData.descriptionFromProducer) return null
    return (
        <MetadataBoxSection title="Documentation from data sources">
            <ExpandableToggle
                label={getProducerDocsLabel(datapageData)}
                content={
                    <div className="indicator-metadata-box__producer-docs">
                        <SimpleMarkdownText
                            text={datapageData.descriptionFromProducer}
                            dataTrackNote="producer_link"
                            dodTrackNote="producer_documentation"
                        />
                    </div>
                }
                onToggle={(isOpen) =>
                    analytics.logExpandableToggle(
                        "producer_documentation",
                        isOpen
                    )
                }
            />
        </MetadataBoxSection>
    )
}

function IndicatorDataSources({
    datapageData,
}: {
    datapageData: DataPageDataV2
}): React.ReactElement {
    const sourcesForDisplay = prepareSourcesForDisplay({
        origins: datapageData.origins,
        source: datapageData.source,
    })
    return (
        <MetadataBoxSection
            title="Data sources"
            id={DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}
        >
            <IndicatorSources
                sources={sourcesForDisplay}
                retrievedFromTrackNote="retrieved_from"
                descriptionTrackNote="source_link"
                dodTrackNote="data_sources"
                hideReuseThisWorkText
                hideTeasers
                onSourceToggle={(_source, index, isOpen) =>
                    analytics.logExpandableToggle(
                        `data_source_${index + 1}`,
                        isOpen
                    )
                }
            />
        </MetadataBoxSection>
    )
}

function CitationSnippet({
    citation,
    trackingContext,
}: {
    citation: string
    trackingContext: string
}): React.ReactElement {
    return (
        <CodeSnippet
            code={citation}
            theme="light"
            useMarkdown={true}
            onCopy={() =>
                analytics.logSiteClick("copy_citation", trackingContext)
            }
        />
    )
}

function IndicatorCitations({
    datapageData,
    canonicalUrl,
    archiveContext,
}: {
    datapageData: DataPageDataV2
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
}): React.ReactElement | null {
    const {
        short: citationShort,
        long: citationLong,
        datapage: citationDatapage,
    } = getIndicatorCitations({
        indicatorTitle: datapageData.title,
        origins: datapageData.origins,
        source: datapageData.source,
        attributions: datapageData.attributions,
        attributionShort: datapageData.attributionShort,
        titleVariant: datapageData.titleVariant,
        owidProcessingLevel: datapageData.owidProcessingLevel,
        citationUrl: archiveContext?.archiveUrl ?? canonicalUrl,
        archivalDate: archiveContext?.archivalDate,
        primaryTopic: datapageData.primaryTopic,
    })

    if (!citationShort && !citationLong) return null
    return (
        <MetadataBoxSection title="How to cite">
            {citationDatapage && (
                <ExpandableToggle
                    label="How to cite this page"
                    content={
                        <>
                            <p>
                                To cite this page overall, including any
                                descriptions, FAQs or explanations of the data
                                authored by Our World in Data, please use the
                                following citation:
                            </p>
                            <CitationSnippet
                                citation={citationDatapage}
                                trackingContext="citation_page"
                            />
                        </>
                    }
                    onToggle={(isOpen) =>
                        analytics.logExpandableToggle(
                            "how_to_cite_page",
                            isOpen
                        )
                    }
                />
            )}
            {citationShort && (
                <ExpandableToggle
                    label="How to cite this data"
                    content={
                        <>
                            <p className="citation__paragraph">
                                If you have limited space (e.g. in data
                                visualizations), you can use this abbreviated
                                in-line citation:
                            </p>
                            <CitationSnippet
                                citation={citationShort}
                                trackingContext="citation_data_short"
                            />
                            {citationLong && (
                                <>
                                    <p className="citation__paragraph">
                                        Full citation
                                    </p>
                                    <CitationSnippet
                                        citation={citationLong}
                                        trackingContext="citation_data_full"
                                    />
                                </>
                            )}
                        </>
                    }
                    onToggle={(isOpen) =>
                        analytics.logExpandableToggle(
                            "how_to_cite_data",
                            isOpen
                        )
                    }
                />
            )}
        </MetadataBoxSection>
    )
}

function IndicatorFinePrint({
    license,
}: {
    license?: LicenseOption
}): React.ReactElement {
    return (
        <MetadataBoxSection className="indicator-metadata-box__reuse-notice">
            <p>
                All data and visualizations on Our World in Data rely on
                original data providers. We process this data, for example by
                standardizing country names and world region definitions,
                converting units, calculating derived indicators such as per
                capita measures, as well as adding or adapting indicator
                metadata. You can{" "}
                <a
                    href="https://docs.owid.io/projects/etl/"
                    data-track-note="data_pipeline_link"
                >
                    read about our data pipeline
                </a>
                , which includes all the code we use to process the data.
            </p>
            <MetadataBoxReuseNotice>
                <ChartLicenseNotice license={license} />
            </MetadataBoxReuseNotice>
        </MetadataBoxSection>
    )
}

function IndicatorMetadataSections({
    datapageData,
    faqEntries,
    detailsRef,
    detailsId,
    canonicalUrl,
    archiveContext,
    descriptionProcessing,
    license,
}: {
    datapageData: DataPageDataV2
    faqEntries: FaqEntryData | undefined
    detailsRef: React.RefObject<HTMLDetailsElement | null>
    detailsId?: string
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
    descriptionProcessing: string | undefined
    license?: LicenseOption
}): React.ReactElement {
    // Only the start of a long descriptionKey is shown above the fold; the
    // rest goes inside the <details> so that it works without JavaScript and
    // browsers auto-expand it when in-page search matches hidden text.
    const { preview: descriptionKeyPreview, remainder: descriptionKeyRest } =
        splitDescriptionKey(datapageData.descriptionKey ?? "")

    return (
        <MetadataBoxExpander
            detailsRef={detailsRef}
            detailsId={detailsId}
            showMoreIcon={faCaretDown}
            showLessIcon={faCaretUp}
            preview={
                descriptionKeyPreview ? (
                    <>
                        <h2 className="indicator-metadata-box__description-key-title">
                            What you should know about this data
                        </h2>
                        <SimpleMarkdownText
                            text={descriptionKeyPreview}
                            dataTrackNote="wysk_link"
                            dodTrackNote="wysk/preview"
                        />
                    </>
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
                    <SimpleMarkdownText
                        text={descriptionKeyRest}
                        dataTrackNote="wysk_link"
                        dodTrackNote="wysk/expanded"
                    />
                </div>
            )}
            <IndicatorDataDetails datapageData={datapageData} />
            <IndicatorFaqs
                descriptionProcessing={descriptionProcessing}
                faqEntries={faqEntries}
            />
            <IndicatorProducerDocs datapageData={datapageData} />
            <IndicatorDataSources datapageData={datapageData} />
            <IndicatorCitations
                datapageData={datapageData}
                canonicalUrl={canonicalUrl}
                archiveContext={archiveContext}
            />
            <IndicatorFinePrint license={license} />
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
}): React.ReactElement {
    // Owners of the dataset backing this indicator. For now we show a single
    // indicator's owners; multi-indicator charts will get a separate metadata
    // expander per indicator, so we don't merge owners across datasets here.
    const owners = datapageData.owners?.[0]?.owners ?? []

    const descriptionProcessing = datapageData.descriptionProcessing?.trim()
    const attribution = formatAttributions(datapageData.attributions ?? [])
    const sourceString = makeSource({
        attribution,
        owidProcessingLevel: datapageData.owidProcessingLevel,
        processingId: descriptionProcessing
            ? INDICATOR_PROCESSING_SECTION_ID
            : null,
    })

    const detailsRef = useRef<HTMLDetailsElement | null>(null)
    const rootRef = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
        const revealHashTarget = (): void => {
            const root = rootRef.current
            if (!root) return
            const target = revealMetadataTarget(root, window.location.hash)
            // Fragment navigation may have run while the target was hidden.
            target?.scrollIntoView()
        }
        revealHashTarget()
        window.addEventListener("hashchange", revealHashTarget)
        return () => window.removeEventListener("hashchange", revealHashTarget)
    }, [])
    // Not useId(): the client hydrates only part of the server-rendered page,
    // so generated ids wouldn't match
    const detailsId = id ? `${id}-details` : undefined

    return (
        <div
            className={cx("metadata-box indicator-metadata-box", className)}
            id={id}
            ref={rootRef}
            onClick={openDetailsAroundLinkTarget}
        >
            <div className="indicator-metadata-box__header">
                <h2 className="indicator-metadata-box__title">
                    {datapageData.title.title}
                    <span className="indicator-metadata-box__title-variant">
                        {datapageData.titleVariant}
                    </span>
                </h2>
                <MetadataBoxToggleButton
                    detailsRef={detailsRef}
                    detailsId={detailsId}
                />
            </div>
            <MetadataBoxKeyData>
                {datapageData.descriptionShort && (
                    <MetadataBoxKeyDataRow
                        label="Description"
                        isFullWidth
                        isLabelScreenReaderOnly
                    >
                        <SimpleMarkdownText
                            text={datapageData.descriptionShort}
                            dodTrackNote="key_data"
                        />
                    </MetadataBoxKeyDataRow>
                )}
                {owners.length > 0 && (
                    <MetadataBoxKeyDataRow
                        label="Managed by"
                        className="indicator-metadata-box__managed-by"
                    >
                        <AvatarByline
                            authors={owners}
                            showInitialsWithoutPhoto
                        />
                    </MetadataBoxKeyDataRow>
                )}
                {sourceString && (
                    <MetadataBoxKeyDataRow
                        label="Data source"
                        labelClassName="metadata-box-key-data__key--source"
                    >
                        {sourceString}
                    </MetadataBoxKeyDataRow>
                )}
            </MetadataBoxKeyData>
            <IndicatorMetadataSections
                datapageData={datapageData}
                faqEntries={faqEntries}
                detailsRef={detailsRef}
                detailsId={detailsId}
                canonicalUrl={canonicalUrl}
                archiveContext={archiveContext}
                descriptionProcessing={descriptionProcessing}
                license={license}
            />
        </div>
    )
}
