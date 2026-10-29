import cx from "clsx"
import * as _ from "lodash-es"
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
    makeLastUpdated,
    makeNextUpdate,
} from "@ourworldindata/components"
import {
    AdditionalIndicator,
    StitchedIndicatorListEntry,
    AuxiliaryIndicator,
    DisplaySource,
    ArchiveContext,
    DataPageDataV2,
    FaqEntryData,
    IndicatorTitleWithFragments,
    LicenseOption,
    OwidEnrichedGdocBlock,
    PrimaryTopic,
} from "@ourworldindata/types"
import React, { createRef, useEffect, useRef, useState } from "react"
import {
    formatAttributions,
    prepareSourcesForDisplay,
    prepareOriginForDisplay,
    getOriginIdentityKey,
    getIndicatorCitations,
    spansToUnformattedPlainText,
} from "@ourworldindata/utils"
import AvatarByline from "./gdocs/components/AvatarByline.js"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"
import { splitDescriptionKey } from "./datapageUtils.js"
import { SiteAnalytics } from "./SiteAnalytics.js"
import {
    IndicatorDropdown,
    IndicatorDropdownSelect,
    IndicatorTabsHorizontal,
    IndicatorTabsVertical,
    IndicatorAboutLabel,
} from "./IndicatorSwitcher.js"
import { useSwitcherVariant } from "./useSwitcherVariant.js"

const analytics = new SiteAnalytics()

interface IndicatorMetadataSectionsProps {
    datapageData: DataPageDataV2
    className?: string
    faqEntries: FaqEntryData | undefined
    detailsRef: React.RefObject<HTMLDetailsElement | null>
    detailsId?: string
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
    primaryTopic?: PrimaryTopic
    title: IndicatorTitleWithFragments
    descriptionProcessing: string | undefined
    license?: LicenseOption
    // Disambiguates the section anchor ids (#faqs, #sources-and-processing,
    // #indicator-processing) when several panes are in the DOM at once. The
    // active pane gets "" so in-page anchors and the grapher footer's
    // jump-to-sources resolve to the visible pane.
    idSuffix?: string
    // Toggles caused by programmatically switching indicators shouldn't be
    // logged as user expands/collapses — see IndicatorMetadataBox.
    suppressToggleLogUntilRef?: React.RefObject<number>
    pageCitation?: PageCitationOptions
    stitched?: StitchedPaneOptions
    // Stitched / single-pane scatter pages: the size/colour line closes the
    // WYSK, in the same typography.
    auxiliaryIndicators?: AuxiliaryIndicator[]
}

/**
 * Multi-indicator pages (switcher or stitched) cite the PAGE by the chart
 * title, and drop the long citation's single-indicator "[dataset]" line:
 * the page shows many indicators, so naming one of them misleads.
 */
interface PageCitationOptions {
    pageTitle: string
    /** Switcher pages: every producer across the page's indicators. */
    producers?: string[]
    /** "How to cite this indicator" on switcher pages. */
    toggleLabel?: string
}

/** The baker stitched the panes into this one — see stitchIndicatorPanes. */
interface StitchedPaneOptions {
    list: StitchedIndicatorListEntry[]
    /** One measure sliced by age/sex/year: don't render the list. */
    hideList?: boolean
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

function IndicatorDataDetails({
    datapageData,
}: {
    datapageData: DataPageDataV2
}): React.ReactElement | null {
    const { unit, dateRange, lastUpdated, nextUpdate } = datapageData
    if (!unit && !dateRange && !lastUpdated && !nextUpdate) return null
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
                {dateRange && (
                    <MetadataBoxKeyDataRow label="Date range">
                        {makeDateRange({ dateRange })}
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

function IndicatorMetadataSections({
    datapageData,
    className,
    faqEntries,
    detailsRef,
    detailsId,
    canonicalUrl,
    archiveContext,
    primaryTopic,
    title,
    descriptionProcessing,
    license,
    idSuffix = "",
    suppressToggleLogUntilRef,
    pageCitation,
    stitched,
    auxiliaryIndicators,
}: IndicatorMetadataSectionsProps) {
    const { origins, source } = datapageData
    const stitchedIndicatorList = stitched?.list
    // Stitched multi-indicator pages: a source the indicators share may still
    // link/cite differently per indicator — show those per indicator inside
    // the shared source's toggle.
    const sourceVariants = new Map<
        string,
        NonNullable<DisplaySource["variants"]>
    >()
    for (const entry of stitchedIndicatorList ?? []) {
        for (const s of entry.sources ?? []) {
            if (!sourceVariants.has(s.key)) sourceVariants.set(s.key, [])
            sourceVariants.get(s.key)!.push({
                label: entry.title,
                retrievedFrom: s.urlMain,
                citation: s.citationFull,
            })
        }
    }
    // Same list as prepareSourcesForDisplay (legacy source first, then the
    // origins in order), with each origin's per-indicator variants attached.
    const sourcesForDisplay: DisplaySource[] = [
        ...prepareSourcesForDisplay({ source }),
        ...(origins ?? []).map((origin) => {
            const variants = sourceVariants.get(getOriginIdentityKey(origin))
            const display = prepareOriginForDisplay(origin)
            return variants ? { ...display, variants } : display
        }),
    ]
    // Stitched pages whose producer documentation differs per indicator: one
    // toggle per indicator under "Documentation from data sources".
    const producerDocEntries = (stitchedIndicatorList ?? []).filter(
        (
            e
        ): e is StitchedIndicatorListEntry & { producerDescription: string } =>
            !!e.producerDescription
    )

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
        datapageCitationTitle: pageCitation?.pageTitle,
        omitLongDatasetTitle: !!pageCitation,
        datapageCitationProducers: pageCitation?.producers,
    })

    const faqQuestions = groupFaqsByQuestion(faqEntries?.faqs ?? [])

    // Only the start of a long descriptionKey is shown above the fold; the
    // rest goes inside the <details> so that it works without JavaScript and
    // browsers auto-expand it when in-page search matches hidden text.
    const { preview: descriptionKeyPreview, remainder: descriptionKeyRest } =
        splitDescriptionKey(datapageData.descriptionKey ?? "")

    // Whether the expander is open: a long stitched indicator list shows in
    // full only then (its folded entries count as part of the expander's
    // content, like the WYSK remainder).
    const [expanderOpen, setExpanderOpen] = useState(false)
    const [listShowFolded, setListShowFolded] = useState(false)

    const showStitchedList =
        !!stitched && !stitched.hideList && stitched.list.length > 0
    // The size/colour line closes the WYSK: in the remainder when there is
    // one, otherwise in the preview.
    const auxInPreview = !!auxiliaryIndicators && !descriptionKeyRest
    const hasPreview =
        showStitchedList || !!descriptionKeyPreview || auxInPreview

    return (
        <MetadataBoxExpander
            className={className}
            detailsRef={detailsRef}
            detailsId={detailsId}
            showMoreIcon={faCaretDown}
            showLessIcon={faCaretUp}
            preview={
                hasPreview ? (
                    <>
                        {showStitchedList && (
                            <StitchedIndicatorList
                                entries={stitched.list}
                                datapageData={datapageData}
                                expanderOpen={expanderOpen}
                                showFolded={listShowFolded}
                                onShowFolded={() => setListShowFolded(true)}
                            />
                        )}
                        {descriptionKeyPreview && (
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
                        )}
                        {auxInPreview && (
                            <AuxiliaryIndicatorsProse
                                indicators={auxiliaryIndicators}
                            />
                        )}
                    </>
                ) : undefined
            }
            onToggle={(isOpen) => {
                setExpanderOpen(isOpen)
                // Closing the box folds a long stitched list again.
                if (!isOpen) setListShowFolded(false)
                // Skip toggles caused by switching indicators: those close
                // the previous pane's expander and open the new one, and
                // neither is a user expand/collapse (the switch itself is
                // logged via data-track-note="metadata_box_indicator_switch").
                if (
                    suppressToggleLogUntilRef &&
                    Date.now() < suppressToggleLogUntilRef.current
                )
                    return
                analytics.logSiteClick(
                    isOpen ? "expand_metadata_box" : "collapse_metadata_box"
                )
            }}
        >
            {descriptionKeyRest && (
                <div className="metadata-box-expander__remainder metadata-box-expander__prose">
                    <SimpleMarkdownText
                        text={descriptionKeyRest}
                        dataTrackNote="wysk_link"
                        dodTrackNote="wysk/expanded"
                    />
                    {auxiliaryIndicators && (
                        <AuxiliaryIndicatorsProse
                            indicators={auxiliaryIndicators}
                        />
                    )}
                </div>
            )}
            <IndicatorDataDetails datapageData={datapageData} />
            <MetadataBoxSection
                title="Frequently asked questions"
                id={`faqs${idSuffix}`}
                className="metadata-box-section--faqs"
            >
                {faqQuestions.map((faq) => (
                    <ExpandableToggle
                        key={faq.question}
                        label={faq.question}
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
                {descriptionProcessing && (
                    <ExpandableToggle
                        label="How did Our World in Data process this data?"
                        contentId={`${INDICATOR_PROCESSING_SECTION_ID}${idSuffix}`}
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
            </MetadataBoxSection>
            {producerDocEntries.length > 0 &&
                !datapageData.descriptionFromProducer && (
                    // Stitched page whose producer docs differ per indicator:
                    // one toggle per indicator, stacked like the Data sources
                    // and FAQ toggles.
                    <MetadataBoxSection title="Documentation from data sources">
                        {producerDocEntries.map((e, i) => (
                            <ExpandableToggle
                                key={i}
                                label={e.title}
                                content={
                                    <div className="indicator-metadata-box__producer-docs">
                                        <SimpleMarkdownText
                                            text={e.producerDescription}
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
                )}
            {datapageData.descriptionFromProducer && (
                <MetadataBoxSection title="Documentation from data sources">
                    <ExpandableToggle
                        label={
                            datapageData.attributionShort ||
                            "Principal data source"
                        }
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
            )}
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
            {(citationShort || citationLong) && (
                <MetadataBoxSection title="How to cite">
                    {citationDatapage && (
                        <ExpandableToggle
                            label="How to cite this page"
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
                                analytics.logExpandableToggle(
                                    "how_to_cite_page",
                                    isOpen
                                )
                            }
                        />
                    )}
                    {citationShort && (
                        <ExpandableToggle
                            label={
                                pageCitation?.toggleLabel ??
                                "How to cite this data"
                            }
                            content={
                                <>
                                    <p className="citation__paragraph">
                                        If you have limited space (e.g. in data
                                        visualizations), you can use this
                                        abbreviated in-line citation:
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
                                analytics.logExpandableToggle(
                                    "how_to_cite_data",
                                    isOpen
                                )
                            }
                        />
                    )}
                </MetadataBoxSection>
            )}
            <MetadataBoxSection className="indicator-metadata-box__reuse-notice">
                <p>
                    All data and visualizations on Our World in Data rely on
                    data sourced from one or several original data providers.
                    Preparing this original data involves several processing
                    steps. Depending on the data, this can include standardizing
                    country names and world region definitions, converting
                    units, calculating derived indicators such as per capita
                    measures, as well as adding or adapting metadata such as the
                    name or the description given to an indicator.
                </p>
                <p>
                    At the link below you can find a detailed description of the
                    structure of our data pipeline, including links to all the
                    code used to prepare data across Our World in Data.{" "}
                    <a
                        href="https://docs.owid.io/projects/etl/"
                        data-track-note="data_pipeline_link"
                    >
                        Read about our data pipeline
                    </a>
                </p>
                <MetadataBoxReuseNotice>
                    <ChartLicenseNotice license={license} />
                </MetadataBoxReuseNotice>
            </MetadataBoxSection>
        </MetadataBoxExpander>
    )
}

// One indicator's pane: heading with the box's top toggle, key data, and the
// expandable sections. Several sit inside one box on a switcher page.
function IndicatorPane({
    datapageData,
    faqEntries,
    detailsRef,
    detailsId,
    canonicalUrl,
    archiveContext,
    license,
    idSuffix = "",
    suppressToggleLogUntilRef,
    stitched,
    pageCitation,
    auxiliaryIndicators,
}: {
    datapageData: DataPageDataV2
    faqEntries: FaqEntryData | undefined
    detailsRef: React.RefObject<HTMLDetailsElement | null>
    detailsId?: string
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
    license?: LicenseOption
    idSuffix?: string
    suppressToggleLogUntilRef?: React.RefObject<number>
    // Stitched: the heading reads "About this data" (no single indicator
    // owns the pane) and the indicator list opens the expander.
    stitched?: StitchedPaneOptions
    pageCitation?: PageCitationOptions
    auxiliaryIndicators?: AuxiliaryIndicator[]
}) {
    // Owners of the dataset backing this indicator — the baker loads each
    // pane's datapageData.owners from its own indicator's dataset.
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

    return (
        <>
            <div className="indicator-metadata-box__header">
                <h2 className="indicator-metadata-box__title">
                    {stitched ? "About this data" : datapageData.title.title}
                    {!stitched && (
                        <span className="indicator-metadata-box__title-variant">
                            {datapageData.titleVariant}
                        </span>
                    )}
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
                        <AvatarByline authors={owners} />
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
                primaryTopic={datapageData.primaryTopic}
                title={datapageData.title}
                descriptionProcessing={descriptionProcessing}
                license={license}
                idSuffix={idSuffix}
                suppressToggleLogUntilRef={suppressToggleLogUntilRef}
                stitched={stitched}
                pageCitation={pageCitation}
                auxiliaryIndicators={auxiliaryIndicators}
            />
        </>
    )
}

export default function IndicatorMetadataBox({
    datapageData,
    additionalIndicators,
    stitchedIndicatorList,
    hideStitchedIndicatorList,
    auxiliaryIndicators,
    faqEntries,
    className,
    id,
    canonicalUrl,
    archiveContext,
    license,
    pageCitationTitle,
}: {
    datapageData: DataPageDataV2
    additionalIndicators?: AdditionalIndicator[]
    stitchedIndicatorList?: StitchedIndicatorListEntry[]
    hideStitchedIndicatorList?: boolean
    auxiliaryIndicators?: AuxiliaryIndicator[]
    className?: string
    id?: string
    faqEntries: FaqEntryData | undefined
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
    license?: LicenseOption
    // The chart title, used to cite the PAGE on multi-indicator pages (the
    // per-indicator titles only describe one of the page's indicators).
    pageCitationTitle?: string
}) {
    const indicators: AdditionalIndicator[] = [
        { datapageData, faqEntries },
        ...(additionalIndicators ?? []),
    ]
    const hasSwitcher = indicators.length > 1
    // The baker stitched a multi-indicator chart's panes into one: render a
    // single pane plus the templated indicator list, and no switcher. The
    // page is still conceptually multi-indicator (citations cite the chart).
    const stitched: StitchedPaneOptions | undefined =
        !hasSwitcher && stitchedIndicatorList?.length
            ? {
                  list: stitchedIndicatorList,
                  hideList: hideStitchedIndicatorList,
              }
            : undefined
    const isMultiIndicator = hasSwitcher || !!stitched
    // Switcher pages cite the PAGE with every producer used across its
    // indicators (a stitched page's panes already share one source set).
    // Some origins carry a semicolon-joined composite producer ("A; B; C"),
    // so split before de-duplicating or the union repeats names.
    const pageCitationProducers = hasSwitcher
        ? _.uniq(
              indicators.flatMap((ind) =>
                  (ind.datapageData.origins ?? []).flatMap((o) =>
                      `${o.producer}`
                          .split(";")
                          .map((x) => x.trim())
                          .filter(Boolean)
                  )
              )
          )
        : undefined
    const pageCitation: PageCitationOptions | undefined = isMultiIndicator
        ? {
              pageTitle: pageCitationTitle ?? datapageData.title.title,
              producers: pageCitationProducers,
              toggleLabel: hasSwitcher
                  ? "How to cite this indicator"
                  : undefined,
          }
        : undefined

    const [activeIndex, setActiveIndex] = useState(0)
    // Guard against the active indicator being unmounted between renders
    // (e.g. if the upstream data shrinks). Falls back to the primary.
    const safeIndex = Math.min(Math.max(activeIndex, 0), indicators.length - 1)

    const switcherVariant = useSwitcherVariant()

    // Each pane's top toggle needs its expander's <details>; the refs are
    // stable across renders (one per pane, created once).
    const [detailsRefs] = useState(() =>
        Array.from({ length: indicators.length }, () =>
            createRef<HTMLDetailsElement>()
        )
    )
    // The box element: the switch effect below finds each pane's expander
    // through it rather than mutating the refs.
    const boxRef = useRef<HTMLDivElement>(null)
    // Derived from the box's id rather than useId(): the server renders the
    // whole page but the client hydrates only the data page content, so
    // generated ids wouldn't match
    const detailsIdFor = (i: number): string | undefined =>
        id ? `${id}-details${i === 0 ? "" : `--${i}`}` : undefined

    // Open the expander whenever the user switches indicator — the click was
    // a request to *see* that indicator's metadata. Skip the initial render
    // so the box doesn't auto-open on page load. <details> fires its toggle
    // event asynchronously, so logging is suppressed for a short window
    // rather than per event.
    const suppressToggleLogUntilRef = useRef(0)
    const isFirstActiveIndexRef = useRef(true)
    useEffect(() => {
        if (isFirstActiveIndexRef.current) {
            isFirstActiveIndexRef.current = false
            return
        }
        suppressToggleLogUntilRef.current = Date.now() + 500
        // Close the now-hidden panes' expanders, so a hidden-but-open one
        // can't keep "Show less" styling on the box, and open the new one.
        const paneEls = boxRef.current?.querySelectorAll(
            ":scope > .indicator-metadata-box__pane"
        )
        paneEls?.forEach((pane, i) => {
            const details = pane.querySelector<HTMLDetailsElement>(
                "details.metadata-box-expander__details"
            )
            if (details) details.open = i === safeIndex
        })
    }, [safeIndex])

    // ALL panes sit in the rendered HTML at once — only the active one is
    // visible — so the others stay available to AI agents and other
    // unmodified-HTML consumers on a plain GET.
    const panes = indicators.map((ind, i) => (
        <div
            key={i}
            className={cx("indicator-metadata-box__pane", {
                "indicator-metadata-box__pane--active": i === safeIndex,
            })}
            data-indicator-index={i}
            aria-hidden={i !== safeIndex}
        >
            <IndicatorPane
                datapageData={ind.datapageData}
                faqEntries={ind.faqEntries}
                detailsRef={detailsRefs[i]}
                detailsId={detailsIdFor(i)}
                canonicalUrl={canonicalUrl}
                archiveContext={archiveContext}
                license={license}
                idSuffix={i === safeIndex ? "" : `--${i}`}
                suppressToggleLogUntilRef={suppressToggleLogUntilRef}
                stitched={stitched}
                pageCitation={pageCitation}
                auxiliaryIndicators={
                    hasSwitcher ? undefined : auxiliaryIndicators
                }
            />
        </div>
    ))

    // A single-indicator page renders exactly as before: one box, one pane.
    if (!isMultiIndicator) {
        return (
            <div
                className={cx("metadata-box indicator-metadata-box", className)}
                id={id}
            >
                <IndicatorPane
                    datapageData={datapageData}
                    faqEntries={faqEntries}
                    detailsRef={detailsRefs[0]}
                    detailsId={detailsIdFor(0)}
                    canonicalUrl={canonicalUrl}
                    archiveContext={archiveContext}
                    license={license}
                    auxiliaryIndicators={auxiliaryIndicators}
                />
            </div>
        )
    }

    // Header row above the box: "About this data (N indicators)" plus the
    // switcher control. The v-tabs variant renders its switcher as an aside
    // beside the box instead.
    const headerSwitcher = stitched ? null : switcherVariant === "dropdown" ? (
        <IndicatorDropdown
            indicators={indicators}
            activeIndex={safeIndex}
            onIndicatorChange={setActiveIndex}
        />
    ) : switcherVariant === "h-tabs" || switcherVariant === "h-pills" ? (
        <>
            <IndicatorAboutLabel indicatorCount={indicators.length} />
            <IndicatorTabsHorizontal
                indicators={indicators}
                activeIndex={safeIndex}
                onIndicatorChange={setActiveIndex}
                variant={switcherVariant === "h-pills" ? "pills" : "tabs"}
            />
            {switcherVariant === "h-pills" && (
                // Mobile control: pills wrap into a ragged stack of rows on
                // narrow screens, so below the small breakpoint the pill row
                // is hidden and this select takes its own row. Both live in
                // the DOM and CSS picks one — SSR can't know the viewport.
                <div className="indicator-metadata-box-wrap__mobile-dropdown">
                    <IndicatorDropdownSelect
                        indicators={indicators}
                        activeIndex={safeIndex}
                        onIndicatorChange={setActiveIndex}
                    />
                </div>
            )}
        </>
    ) : null

    return (
        <div
            className={cx(
                "indicator-metadata-box-wrap",
                `indicator-metadata-box-wrap--${switcherVariant}`,
                { "indicator-metadata-box-wrap--stitched": !!stitched },
                className
            )}
            id={id}
        >
            {headerSwitcher && (
                <div className="indicator-metadata-box-wrap__header">
                    {headerSwitcher}
                </div>
            )}
            {hasSwitcher && auxiliaryIndicators && (
                // Switcher pages: the size/colour line belongs to the chart,
                // not to any one pane, so it sits under "About this data" and
                // the pills, on top of the box.
                <AuxiliaryIndicatorsLine indicators={auxiliaryIndicators} />
            )}
            <div className="indicator-metadata-box-wrap__main">
                {switcherVariant === "v-tabs" && (
                    <IndicatorTabsVertical
                        indicators={indicators}
                        activeIndex={safeIndex}
                        onIndicatorChange={setActiveIndex}
                    />
                )}
                <div
                    className="metadata-box indicator-metadata-box"
                    ref={boxRef}
                >
                    {panes}
                </div>
            </div>
        </div>
    )
}

// "Title." for a title that runs into its description; leaves titles that
// already end in punctuation alone.
const withFinalStop = (title: string): string =>
    /[.!?:]$/.test(title.trim()) ? title : `${title}.`

function StitchedIndicatorList({
    entries,
    datapageData,
    expanderOpen,
    showFolded,
    onShowFolded,
}: {
    entries: StitchedIndicatorListEntry[]
    datapageData: DataPageDataV2
    expanderOpen: boolean
    /** The reader asked for the folded entries (reset when the box closes). */
    showFolded: boolean
    onShowFolded: () => void
}) {
    // Distinct sources: one dataset split across ETL snapshots is one source.
    const nSources =
        _.uniq((datapageData.origins ?? []).map(getOriginIdentityKey)).length +
        (datapageData.source ? 1 : 0)
    const sourcePhrase =
        nSources > 0
            ? `, all from the same data source${nSources > 1 ? "s" : ""}`
            : ""
    // A titleVariant the baker left on the pane is shared by every indicator
    // (otherwise it clears it and the entries carry their own).
    const sharedVariant = datapageData.titleVariant?.trim()
    const variantPhrase = sharedVariant ? ` (${sharedVariant})` : ""
    // Up to five entries always show in full. A longer list shows its first
    // three and a "+N more indicators" line: plain muted text while the box
    // is closed (the box's "Show more" is the one control there), a button
    // once the box is open, which reveals the rest. Closing the box folds
    // the list again. Folded entries stay in the DOM, hidden, for raw-HTML
    // consumers.
    const SHOW_ALL_UP_TO = 5
    const FOLD_AFTER = 3
    const expanded =
        entries.length <= SHOW_ALL_UP_TO || (expanderOpen && showFolded)
    const nFolded = entries.length - FOLD_AFTER
    const moreLabel = `+${nFolded} more indicators`
    // The list renders inside the expander's preview, a prose block, so it
    // inherits the WYSK's type and spacing and reads as the paragraph before
    // it.
    const blockClass = "indicator-metadata-box__stitched-list"

    const intro = (
        <>
            This chart shows data for {entries.length} indicators
            {variantPhrase}
            {sourcePhrase}
        </>
    )
    // Entries whose only extra is a description read as prose on one line
    // ("Title. Description."); once units vary too, the description and the
    // unit each get their own line with a muted key, like the pane's key data.
    const hasUnits = entries.some((entry) => entry.unit)
    return (
        <div className={blockClass}>
            <p>{intro}:</p>
            <ol>
                {entries.map((entry, i) => (
                    <li key={i} hidden={!expanded && i >= FOLD_AFTER}>
                        {hasUnits ? (
                            <>
                                <span className="indicator-metadata-box__stitched-list-title">
                                    {entry.title}
                                </span>
                                {entry.short && (
                                    <span className="indicator-metadata-box__stitched-list-row">
                                        <span className="indicator-metadata-box__stitched-list-key">
                                            Description
                                        </span>{" "}
                                        <SimpleMarkdownText
                                            text={entry.short}
                                            useParagraphs={false}
                                        />
                                    </span>
                                )}
                                {entry.unit && (
                                    <span className="indicator-metadata-box__stitched-list-row">
                                        <span className="indicator-metadata-box__stitched-list-key">
                                            Unit
                                        </span>{" "}
                                        {entry.unit}
                                    </span>
                                )}
                            </>
                        ) : (
                            <span className="indicator-metadata-box__stitched-list-row">
                                <strong>{withFinalStop(entry.title)}</strong>
                                {entry.short && (
                                    <>
                                        {" "}
                                        <SimpleMarkdownText
                                            text={entry.short}
                                            useParagraphs={false}
                                        />
                                    </>
                                )}
                            </span>
                        )}
                        {entry.note && (
                            <div className="indicator-metadata-box__stitched-list-note">
                                <SimpleMarkdownText
                                    text={entry.note}
                                    useParagraphs={false}
                                />
                            </div>
                        )}
                    </li>
                ))}
            </ol>
            {!expanded && (
                <p className="indicator-metadata-box__stitched-list-more">
                    {expanderOpen ? (
                        <button
                            type="button"
                            className="indicator-metadata-box__stitched-list-more-button"
                            onClick={onShowFolded}
                            data-track-note="metadata_box_indicator_list_toggle"
                        >
                            {moreLabel}
                        </button>
                    ) : (
                        moreLabel
                    )}
                </p>
            )}
        </div>
    )
}

const AUXILIARY_LINE_LABEL: Record<AuxiliaryIndicator["role"], string> = {
    size: "Bubble size",
    color: "Color",
}

// The indicator's title, linking to its own data page when it has one.
function AuxiliaryIndicatorLink({
    indicator,
}: {
    indicator: AuxiliaryIndicator
}) {
    return indicator.slug ? (
        <a href={`/grapher/${indicator.slug}`}>{indicator.title}</a>
    ) : (
        <>{indicator.title}</>
    )
}

// Stitched / single-pane scatter pages (?auxiliary=mixed|line): the
// size/colour line closes the WYSK as one more paragraph in its typography.
function AuxiliaryIndicatorsProse({
    indicators,
}: {
    indicators: AuxiliaryIndicator[]
}) {
    return (
        <p className="indicator-metadata-box__auxiliary-prose">
            {indicators.map((ind, i) => (
                <React.Fragment key={ind.role}>
                    {i > 0 && " · "}
                    <strong>{AUXILIARY_LINE_LABEL[ind.role]}:</strong>{" "}
                    <AuxiliaryIndicatorLink indicator={ind} />
                </React.Fragment>
            ))}
        </p>
    )
}

// Switcher pages (?auxiliary=mixed|line): the size/colour line under the
// "About this data" header, styled like the key data rows. In the default
// "panes" mode these indicators get panes instead and this isn't rendered.
function AuxiliaryIndicatorsLine({
    indicators,
}: {
    indicators: AuxiliaryIndicator[]
}) {
    return (
        <div className="indicator-metadata-box__auxiliary">
            <MetadataBoxKeyData>
                {indicators.map((ind) => (
                    <MetadataBoxKeyDataRow
                        key={ind.role}
                        label={AUXILIARY_LINE_LABEL[ind.role]}
                    >
                        <AuxiliaryIndicatorLink indicator={ind} />
                    </MetadataBoxKeyDataRow>
                ))}
            </MetadataBoxKeyData>
        </div>
    )
}
