import { faCaretDown, faCaretUp } from "@fortawesome/free-solid-svg-icons"
import {
    DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
    SimpleMarkdownText,
    IndicatorSources,
    ExpandableToggle,
    CodeSnippet,
    makeSource,
    INDICATOR_PROCESSING_SECTION_ID,
    REUSE_THIS_WORK_SECTION_ID,
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
    IndicatorPaneData,
    LicenseOption,
    MultiIndicatorMetadata,
    OwidEnrichedGdocBlock,
    SourceLinksByIndicator,
    StitchedIndicator,
} from "@ourworldindata/types"
import cx from "clsx"
import { createRef, useEffect, useRef, useState } from "react"
import {
    formatAttributions,
    prepareSourcesForDisplay,
    getIndicatorCitations,
    spansToUnformattedPlainText,
    type PageCitation,
} from "@ourworldindata/utils"
import AvatarByline from "./gdocs/components/AvatarByline.js"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"
import {
    appendTitleVariant,
    getProducerDocsLabel,
    splitDescriptionKey,
} from "./datapageUtils.js"
import { SiteAnalytics } from "./SiteAnalytics.js"
import {
    IndicatorDropdown,
    IndicatorSwitchButton,
} from "./IndicatorSwitcher.js"
import { useSwitcherVariant } from "./useSwitcherVariant.js"

const analytics = new SiteAnalytics()

type StitchedMetadata = Extract<MultiIndicatorMetadata, { type: "stitched" }>

// A longer list of indicators shows its first few until the reader asks for
// the rest
const MAX_INDICATORS_LISTED_IN_FULL = 5
const INDICATORS_LISTED_WHEN_FOLDED = 3

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
    stitchedIndicators = [],
}: {
    datapageData: DataPageDataV2
    /** A stitched pane's indicators, when it lists them */
    stitchedIndicators?: StitchedIndicator[]
}): React.ReactElement | null {
    const { unit, dateRange, lastUpdated, nextUpdate } = datapageData
    // Indicators that give their own date ranges make the span of them all
    // redundant
    const formattedDateRange = stitchedIndicators.some(
        (indicator) => indicator.dateRange
    )
        ? undefined
        : makeDateRange({ dateRange })
    if (
        !unit &&
        !formattedDateRange &&
        !lastUpdated &&
        !nextUpdate &&
        stitchedIndicators.length === 0
    )
        return null
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
            {stitchedIndicators.length > 0 && (
                <StitchedIndicatorList
                    indicators={stitchedIndicators}
                    sharedTitleVariant={datapageData.titleVariant?.trim()}
                />
            )}
        </MetadataBoxSection>
    )
}

/** What differs between a stitched pane's indicators, one entry for each. */
function StitchedIndicatorList({
    indicators,
    sharedTitleVariant,
}: {
    indicators: StitchedIndicator[]
    sharedTitleVariant?: string
}): React.ReactElement {
    const [isExpanded, setIsExpanded] = useState(false)
    const isFoldable = indicators.length > MAX_INDICATORS_LISTED_IN_FULL
    const visibleCount =
        isFoldable && !isExpanded
            ? INDICATORS_LISTED_WHEN_FOLDED
            : indicators.length
    const listRef = useRef<HTMLDivElement>(null)
    const fold = (): void => {
        setIsExpanded(false)
        // Folding pulls the page up under the reader, so a list whose top
        // has scrolled out of view is brought back
        const list = listRef.current
        if (list && list.getBoundingClientRect().top < 0)
            list.scrollIntoView({ block: "start" })
    }
    return (
        <div className="indicator-metadata-box__indicator-list" ref={listRef}>
            <h3 className="indicator-metadata-box__indicator-list-heading">
                {indicators.length} indicators
                {sharedTitleVariant && ` (${sharedTitleVariant})`}
            </h3>
            <ul>
                {indicators.map((indicator, i) => (
                    // Folded indicators stay in the HTML, where find-in-page
                    // and agents can read them
                    <li key={i} hidden={i >= visibleCount}>
                        <span className="indicator-metadata-box__indicator-list-title">
                            {appendTitleVariant(
                                indicator.title,
                                indicator.titleVariant
                            )}
                        </span>
                        {indicator.descriptionShort && (
                            <span className="indicator-metadata-box__indicator-list-text">
                                <SimpleMarkdownText
                                    text={indicator.descriptionShort}
                                    useParagraphs={false}
                                />
                            </span>
                        )}
                        {(indicator.unit || indicator.dateRange) && (
                            <span className="indicator-metadata-box__indicator-list-key-data">
                                {indicator.unit && (
                                    <span>
                                        <span className="indicator-metadata-box__indicator-list-key">
                                            Unit
                                        </span>{" "}
                                        {indicator.unit}
                                    </span>
                                )}
                                {indicator.dateRange && (
                                    <span>
                                        <span className="indicator-metadata-box__indicator-list-key">
                                            {makeDateRangeLabel({
                                                dateRange: indicator.dateRange,
                                            })}
                                        </span>{" "}
                                        {makeDateRange({
                                            dateRange: indicator.dateRange,
                                        })}
                                    </span>
                                )}
                            </span>
                        )}
                        {indicator.descriptionKey && (
                            <span className="indicator-metadata-box__indicator-list-text">
                                <SimpleMarkdownText
                                    text={indicator.descriptionKey}
                                    useParagraphs={false}
                                />
                            </span>
                        )}
                    </li>
                ))}
            </ul>
            {isFoldable && (
                <button
                    type="button"
                    className="indicator-metadata-box__indicator-list-toggle"
                    onClick={isExpanded ? fold : () => setIsExpanded(true)}
                    aria-expanded={isExpanded}
                    data-track-note="metadata_box_indicator_list_toggle"
                >
                    {isExpanded
                        ? "− Show less indicators"
                        : "+ Show more indicators"}
                </button>
            )}
        </div>
    )
}

function IndicatorFaqs({
    descriptionProcessing,
    faqEntries,
    idSuffix,
}: {
    descriptionProcessing: string | undefined
    faqEntries: FaqEntryData | undefined
    idSuffix: string
}): React.ReactElement | null {
    const faqQuestions = groupFaqsByQuestion(faqEntries?.faqs ?? [])
    if (!descriptionProcessing && faqQuestions.length === 0) return null

    return (
        <MetadataBoxSection
            title="Frequently asked questions"
            id={`faqs${idSuffix}`}
            className="metadata-box-section--faqs"
        >
            {descriptionProcessing && (
                <ExpandableToggle
                    label="How did Our World in Data process this data?"
                    id={`${INDICATOR_PROCESSING_SECTION_ID}${idSuffix}`}
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
                    key={faq.id}
                    id={`${faq.id}${idSuffix}`}
                    label={faq.question}
                    content={
                        <ArticleBlocks
                            blocks={faq.answer}
                            containerType="datapage"
                        />
                    }
                    onToggle={(isOpen) =>
                        analytics.logExpandableToggle(
                            // The question itself, kept short for the event
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
    stitchedIndicators = [],
}: {
    datapageData: DataPageDataV2
    stitchedIndicators?: StitchedIndicator[]
}): React.ReactElement | null {
    // The pane's own or, on a stitched pane whose indicators' differ, each
    // of theirs
    const docs = datapageData.descriptionFromProducer
        ? [
              {
                  label: getProducerDocsLabel(datapageData),
                  text: datapageData.descriptionFromProducer,
              },
          ]
        : stitchedIndicators.flatMap((indicator) =>
              indicator.descriptionFromProducer
                  ? [
                        {
                            label: appendTitleVariant(
                                indicator.title,
                                indicator.titleVariant
                            ),
                            text: indicator.descriptionFromProducer,
                        },
                    ]
                  : []
          )
    if (docs.length === 0) return null
    return (
        <MetadataBoxSection title="Documentation from data sources">
            {docs.map(({ label, text }, i) => (
                <ExpandableToggle
                    key={i}
                    label={label}
                    content={
                        <div className="indicator-metadata-box__producer-docs">
                            <SimpleMarkdownText
                                text={text}
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
            ))}
        </MetadataBoxSection>
    )
}

function IndicatorDataSources({
    datapageData,
    sourceLinksByIndicator,
    idSuffix,
}: {
    datapageData: DataPageDataV2
    sourceLinksByIndicator?: SourceLinksByIndicator[]
    idSuffix: string
}): React.ReactElement {
    const sourcesForDisplay = prepareSourcesForDisplay(
        { origins: datapageData.origins, source: datapageData.source },
        sourceLinksByIndicator
    )
    return (
        <MetadataBoxSection
            title="Data sources"
            id={`${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}${idSuffix}`}
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
    pageCitation,
    dataCitationLabel,
    idSuffix,
}: {
    datapageData: DataPageDataV2
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
    pageCitation?: PageCitation
    dataCitationLabel: string
    idSuffix: string
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
        pageCitation,
    })

    if (!citationShort && !citationLong) return null
    return (
        <MetadataBoxSection
            title="How to cite"
            // The old layout's id, which existing links still use
            id={`${REUSE_THIS_WORK_SECTION_ID}${idSuffix}`}
        >
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
                    label={dataCitationLabel}
                    content={
                        <>
                            <p>
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
                                    <p>Full citation</p>
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

/**
 * One indicator's metadata: a header with the box's toggle, the key data and
 * the expandable sections. A box with a switcher holds one for each indicator
 * and shows the active one.
 */
function IndicatorPane({
    datapageData,
    faqEntries,
    canonicalUrl,
    archiveContext,
    detailsRef,
    detailsId,
    idSuffix,
    onToggle,
    stitched,
    pageCitation,
    hasSwitcher,
    headerControl,
    hideTitle = false,
}: {
    datapageData: DataPageDataV2
    faqEntries: FaqEntryData | undefined
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
    detailsRef: React.RefObject<HTMLDetailsElement | null>
    detailsId: string | undefined
    /** Keeps the section ids unique among the panes of a box */
    idSuffix: string
    onToggle: (isOpen: boolean) => void
    stitched: StitchedMetadata | undefined
    pageCitation: PageCitation | undefined
    hasSwitcher: boolean
    /** Sits beside the title */
    headerControl?: React.ReactNode
    /**
     * For when the switcher above the box names the indicator: the short
     * description then takes the title's place in the header.
     */
    hideTitle?: boolean
}): React.ReactElement {
    // Each pane shows who manages its own indicator's dataset
    const owners = datapageData.owners?.[0]?.owners ?? []

    const descriptionProcessing = datapageData.descriptionProcessing?.trim()
    const attribution = formatAttributions(datapageData.attributions ?? [])
    const sourceString = makeSource({
        attribution,
        owidProcessingLevel: datapageData.owidProcessingLevel,
        // Without processing notes there's nothing to link to
        processingId: descriptionProcessing
            ? `${INDICATOR_PROCESSING_SECTION_ID}${idSuffix}`
            : null,
    })

    // Only the start of a long descriptionKey is shown above the fold; the
    // rest goes inside the <details> so that it works without JavaScript and
    // browsers auto-expand it when in-page search matches hidden text.
    const { preview: descriptionKeyPreview, remainder: descriptionKeyRest } =
        splitDescriptionKey(datapageData.descriptionKey ?? "")

    return (
        <>
            <div className="indicator-metadata-box__header">
                <div className="indicator-metadata-box__heading">
                    <h2
                        className={cx("indicator-metadata-box__title", {
                            "indicator-metadata-box__title--hidden": hideTitle,
                        })}
                    >
                        {stitched
                            ? "About this data"
                            : datapageData.title.title}
                        {!stitched && datapageData.titleVariant && (
                            <span className="indicator-metadata-box__title-variant">
                                {datapageData.titleVariant}
                            </span>
                        )}
                    </h2>
                    {headerControl && (
                        <div className="indicator-metadata-box__header-control">
                            {headerControl}
                        </div>
                    )}
                    {hideTitle && datapageData.descriptionShort && (
                        <div className="indicator-metadata-box__header-description">
                            <SimpleMarkdownText
                                text={datapageData.descriptionShort}
                                dodTrackNote="key_data"
                            />
                        </div>
                    )}
                </div>
                <MetadataBoxToggleButton
                    detailsRef={detailsRef}
                    detailsId={detailsId}
                />
            </div>
            <MetadataBoxKeyData>
                {datapageData.descriptionShort && !hideTitle && (
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
            <MetadataBoxExpander
                className={cx({
                    "indicator-metadata-box__expander--has-preview":
                        descriptionKeyPreview,
                })}
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
                onToggle={onToggle}
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
                <IndicatorDataDetails
                    datapageData={datapageData}
                    stitchedIndicators={
                        stitched?.showIndicatorList
                            ? stitched.indicators
                            : undefined
                    }
                />
                <IndicatorFaqs
                    descriptionProcessing={descriptionProcessing}
                    faqEntries={faqEntries}
                    idSuffix={idSuffix}
                />
                <IndicatorProducerDocs
                    datapageData={datapageData}
                    stitchedIndicators={stitched?.indicators}
                />
                <IndicatorDataSources
                    datapageData={datapageData}
                    sourceLinksByIndicator={stitched?.sourceLinksByIndicator}
                    idSuffix={idSuffix}
                />
                <IndicatorCitations
                    datapageData={datapageData}
                    canonicalUrl={canonicalUrl}
                    archiveContext={archiveContext}
                    pageCitation={pageCitation}
                    dataCitationLabel={
                        hasSwitcher
                            ? "How to cite this indicator"
                            : "How to cite this data"
                    }
                    idSuffix={idSuffix}
                />
                <IndicatorFinePrint license={datapageData.license} />
            </MetadataBoxExpander>
        </>
    )
}

export default function IndicatorMetadataBox({
    datapageData,
    faqEntries,
    multiIndicator,
    chartTitle,
    id,
    canonicalUrl,
    archiveContext,
}: {
    datapageData: DataPageDataV2
    faqEntries: FaqEntryData | undefined
    multiIndicator?: MultiIndicatorMetadata
    /** Names the page in its citation when the chart has several indicators */
    chartTitle?: string
    id?: string
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
}): React.ReactElement {
    const panes: IndicatorPaneData[] = [
        { datapageData, faqEntries },
        ...(multiIndicator?.type === "switcher"
            ? multiIndicator.additionalPanes
            : []),
    ]
    const hasSwitcher = panes.length > 1
    const pageCitation: PageCitation | undefined = multiIndicator && {
        title: chartTitle ?? datapageData.title.title,
        origins: hasSwitcher
            ? panes.flatMap((pane) => pane.datapageData.origins ?? [])
            : undefined,
    }

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

    const switcherVariant = useSwitcherVariant()
    const [activeIndex, setActiveIndex] = useState(0)
    const [hasSwitched, setHasSwitched] = useState(false)
    const [detailsRefs] = useState(() =>
        panes.map(() => createRef<HTMLDetailsElement>())
    )
    // The panes whose <details> a switch has opened or closed, until their
    // toggle events arrive
    const panesToggledBySwitch = useRef(new Set<number>())

    const switchToPane = (index: number): void => {
        // Asking for an indicator is asking to see its metadata, so its pane
        // opens. The others close, to be closed when they next show.
        detailsRefs.forEach((detailsRef, paneIndex) => {
            const details = detailsRef.current
            const shouldBeOpen = paneIndex === index
            if (!details || details.open === shouldBeOpen) return
            panesToggledBySwitch.current.add(paneIndex)
            details.open = shouldBeOpen
        })
        setActiveIndex(index)
        setHasSwitched(true)
    }

    const logToggle = (paneIndex: number, isOpen: boolean): void => {
        // Only the reader's own expanding and collapsing is logged
        if (panesToggledBySwitch.current.delete(paneIndex)) return
        analytics.logSiteClick(
            isOpen ? "expand_metadata_box" : "collapse_metadata_box"
        )
    }

    const renderPane = (
        pane: IndicatorPaneData,
        paneIndex: number
    ): React.ReactElement => {
        const isActive = paneIndex === activeIndex
        // The active pane has the plain ids, which the rest of the page
        // links to. Not useId(): the client hydrates only part of the
        // server-rendered page, so generated ids wouldn't match.
        const idSuffix = isActive ? "" : `--${paneIndex}`
        return (
            <IndicatorPane
                datapageData={pane.datapageData}
                faqEntries={pane.faqEntries}
                canonicalUrl={canonicalUrl}
                archiveContext={archiveContext}
                detailsRef={detailsRefs[paneIndex]}
                detailsId={id ? `${id}-details${idSuffix}` : undefined}
                idSuffix={idSuffix}
                onToggle={(isOpen) => logToggle(paneIndex, isOpen)}
                stitched={
                    multiIndicator?.type === "stitched"
                        ? multiIndicator
                        : undefined
                }
                pageCitation={pageCitation}
                hasSwitcher={hasSwitcher}
                headerControl={
                    hasSwitcher &&
                    isActive &&
                    switcherVariant === "dropdown-inside" && (
                        <IndicatorSwitchButton
                            panes={panes}
                            activeIndex={activeIndex}
                            onChange={switchToPane}
                            // A switch replaces the button that had focus
                            // with this pane's
                            focusOnMount={hasSwitched}
                        />
                    )
                }
                hideTitle={hasSwitcher && switcherVariant === "dropdown"}
            />
        )
    }

    if (!hasSwitcher)
        return (
            <div
                className="metadata-box indicator-metadata-box"
                id={id}
                ref={rootRef}
                onClick={openDetailsAroundLinkTarget}
            >
                {renderPane(panes[0], 0)}
            </div>
        )

    return (
        <div
            className="indicator-metadata-box-wrap"
            id={id}
            ref={rootRef}
            onClick={openDetailsAroundLinkTarget}
        >
            {switcherVariant === "dropdown" && (
                <div className="indicator-metadata-box-wrap__header">
                    <IndicatorDropdown
                        panes={panes}
                        activeIndex={activeIndex}
                        onChange={switchToPane}
                    />
                </div>
            )}
            <div className="metadata-box indicator-metadata-box">
                {/* Every pane is in the HTML, where agents can read it */}
                {panes.map((pane, paneIndex) => (
                    <div
                        key={paneIndex}
                        className={cx("indicator-metadata-box__pane", {
                            "indicator-metadata-box__pane--active":
                                paneIndex === activeIndex,
                        })}
                    >
                        {renderPane(pane, paneIndex)}
                    </div>
                ))}
            </div>
        </div>
    )
}
