import cx from "clsx"
import * as _ from "lodash-es"
import {
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
import React, { createRef, useEffect, useMemo, useRef, useState } from "react"
import {
    formatAttributions,
    prepareSourcesForDisplay,
    prepareOriginForDisplay,
    getOriginIdentityKey,
    getIndicatorCitations,
    spansToUnformattedPlainText,
} from "@ourworldindata/utils"
import { Byline } from "./gdocs/components/Byline.js"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons"
import { splitDescriptionKey } from "./datapageUtils.js"
import { SiteAnalytics } from "./SiteAnalytics.js"
import { ChartLicenseNotice } from "./ChartLicenseNotice.js"
import {
    IndicatorDropdown,
    IndicatorDropdownSelect,
    IndicatorTabsHorizontal,
    IndicatorTabsVertical,
    IndicatorAboutLabel,
} from "./IndicatorSwitcher.js"
import { useSwitcherVariant } from "./useSwitcherVariant.js"

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
    license?: LicenseOption
    faqsSectionId: string
    sourcesSectionId: string
    processingContentId: string
    // See IndicatorMetadataBox: toggles caused by programmatically switching
    // indicators shouldn't be logged as user expands/collapses.
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

const FAQS_SECTION_ID = "faqs"

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
    license,
    faqsSectionId,
    sourcesSectionId,
    processingContentId,
    suppressToggleLogUntilRef,
    pageCitation,
    stitched,
    auxiliaryIndicators,
}: ExpandableSectionProps) {
    const stitchedIndicatorList = stitched?.list
    const { origins, source } = datapageData
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

    // overflow-anchor: none; is set on this page so that scroll position doesn't jump when collapsing FAQ/sources
    // but when collapsing the metadata box itself, we want to jump back to the top
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

    // Only the start of a long descriptionKey is shown above the fold; the
    // rest goes inside the <details> so that it works without JavaScript and
    // browsers auto-expand it when in-page search matches hidden text.
    const { preview: descriptionKeyPreview, remainder: descriptionKeyRest } =
        splitDescriptionKey(datapageData.descriptionKey ?? "")

    // Whether the box's own expander is open. A long stitched indicator list
    // shows in full only then: its folded entries count as part of the
    // expander's content, like the WYSK remainder.
    const [detailsOpen, setDetailsOpen] = useState(false)

    return (
        <div className={cx("meta-expander", className)}>
            {stitched && !stitched.hideList && stitched.list.length > 0 && (
                <StitchedIndicatorList
                    entries={stitched.list}
                    datapageData={datapageData}
                    expanderOpen={detailsOpen}
                    onShowAll={() => {
                        if (detailsRef.current) detailsRef.current.open = true
                    }}
                />
            )}
            {(descriptionKeyPreview ||
                (auxiliaryIndicators && !descriptionKeyRest)) && (
                <div className="meta-expander__preview meta-expander__prose">
                    {descriptionKeyPreview && (
                        <SimpleMarkdownText text={descriptionKeyPreview} />
                    )}
                    {auxiliaryIndicators && !descriptionKeyRest && (
                        <AuxiliaryIndicatorsProse
                            indicators={auxiliaryIndicators}
                        />
                    )}
                </div>
            )}
            <details
                className="meta-expander__details"
                ref={detailsRef}
                // React 19 simulates bubbling for `toggle`, so toggles from the
                // nested ExpandableToggles would otherwise fire this handler too.
                // Guard to only react to this element's own toggle.
                onToggle={(e) => {
                    if (e.target !== e.currentTarget) return
                    setDetailsOpen(e.currentTarget.open)
                    // Skip toggles caused by switching indicators: those
                    // programmatically close the previous pane's details and
                    // open the new one, and neither is a user
                    // expand/collapse (the switch itself is logged via
                    // data-track-note="metadata_box_indicator_switch").
                    if (Date.now() < (suppressToggleLogUntilRef?.current ?? 0))
                        return
                    // Also skip hidden panes (display: none → offsetParent
                    // is null) in case they're toggled programmatically
                    // outside a switch.
                    if (!e.currentTarget.offsetParent) return
                    analytics.logSiteClick(
                        e.currentTarget.open
                            ? "expand_metadata_box"
                            : "collapse_metadata_box"
                    )
                }}
            >
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
                {descriptionKeyRest && (
                    <div className="meta-expander__remainder meta-expander__prose">
                        <SimpleMarkdownText text={descriptionKeyRest} />
                        {auxiliaryIndicators && (
                            <AuxiliaryIndicatorsProse
                                indicators={auxiliaryIndicators}
                            />
                        )}
                    </div>
                )}
                {
                    <section className="meta-expander__section meta-expander__section--faqs">
                        <h2
                            className="meta-expander__section-title"
                            id={faqsSectionId}
                        >
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
                            contentId={processingContentId}
                            content={
                                <IndicatorProcessing
                                    descriptionProcessing={
                                        descriptionProcessing
                                    }
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
                {(datapageData.descriptionFromProducer ||
                    producerDocEntries.length > 0) && (
                    <section className="meta-expander__section">
                        <h2 className="meta-expander__section-title">
                            Documentation from data sources
                        </h2>
                        {datapageData.descriptionFromProducer ? (
                            <ExpandableToggle
                                label={
                                    datapageData.attributionShort ||
                                    "Principal data source"
                                }
                                content={
                                    <SimpleMarkdownText
                                        text={
                                            datapageData.descriptionFromProducer
                                        }
                                    />
                                }
                                onToggle={(isOpen) =>
                                    logExpandableToggle(
                                        "producer_documentation",
                                        isOpen
                                    )
                                }
                            />
                        ) : (
                            // Stitched page whose producer docs differ per
                            // indicator: one toggle per indicator, stacked like
                            // the Data sources and FAQ toggles.
                            producerDocEntries.map((e, i) => (
                                <ExpandableToggle
                                    key={i}
                                    label={e.title}
                                    isStacked={
                                        i < producerDocEntries.length - 1
                                    }
                                    content={
                                        <SimpleMarkdownText
                                            text={e.producerDescription}
                                        />
                                    }
                                    onToggle={(isOpen) =>
                                        logExpandableToggle(
                                            "producer_documentation",
                                            isOpen
                                        )
                                    }
                                />
                            ))
                        )}
                    </section>
                )}
                <section className="meta-expander__section">
                    <h2
                        id={sourcesSectionId}
                        className="meta-expander__section-title"
                    >
                        Data sources
                    </h2>
                    <IndicatorSources
                        sources={sourcesForDisplay}
                        hideReuseThisWorkText
                        hideTeasers
                        onSourceToggle={(_source, index, isOpen) =>
                            logExpandableToggle(
                                `data_source_${index + 1}`,
                                isOpen
                            )
                        }
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
                                    logExpandableToggle(
                                        "how_to_cite_page",
                                        isOpen
                                    )
                                }
                            />
                        )}
                        <section className="indicator-sources">
                            {citationShort && (
                                <ExpandableToggle
                                    label={
                                        pageCitation?.toggleLabel ??
                                        "How to cite this data"
                                    }
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
                        <ChartLicenseNotice license={license} />
                    </p>
                </section>
            </details>
        </div>
    )
}

// The full per-indicator body of the metadata box: title, description
// table, and the collapsible details section. On multi-indicator charts one
// pane renders per Y-indicator (all present in the HTML; only the active
// one visible) so the switcher can flip between them without re-fetching.
function IndicatorPaneContent({
    datapageData,
    faqEntries,
    detailsRef,
    canonicalUrl,
    archiveContext,
    license,
    idSuffix,
    suppressToggleLogUntilRef,
    pageCitation,
    stitched,
    auxiliaryIndicators,
}: {
    datapageData: DataPageDataV2
    faqEntries: FaqEntryData | undefined
    detailsRef: React.RefObject<HTMLDetailsElement | null>
    canonicalUrl: string
    archiveContext: ArchiveContext | undefined
    license?: LicenseOption
    suppressToggleLogUntilRef?: React.RefObject<number>
    pageCitation?: PageCitationOptions
    // Stitched: the pane heading reads "About this data" (no single
    // indicator owns the pane) and the indicator list renders inside the
    // expander, above the shared WYSK.
    stitched?: StitchedPaneOptions
    // Set only when the box has a single visible pane (stitched or
    // single-indicator): the size/colour line then closes the WYSK.
    // Switcher pages render it once, under the "About this data" header.
    auxiliaryIndicators?: AuxiliaryIndicator[]
    // Disambiguates the section anchor ids (#faqs, #sources-and-processing,
    // #indicator-processing) when several panes are in the DOM at once. The
    // active pane always gets the canonical (un-suffixed) ids so in-page
    // anchors and the grapher footer's jump-to-sources always resolve to
    // the visible pane.
    idSuffix: string
}) {
    // Owners of the dataset backing this indicator — the baker loads each
    // pane's datapageData.owners from its own indicator's dataset.
    const owners = datapageData.owners?.[0]?.owners ?? []

    const attribution = formatAttributions(datapageData.attributions ?? [])
    const processingContentId = `${INDICATOR_PROCESSING_SECTION_ID}${idSuffix}`
    const sourceString = makeSource({
        attribution,
        owidProcessingLevel: datapageData.owidProcessingLevel,
        processingId: processingContentId,
    })

    return (
        <>
            <h2 className="indicator-metadata-box__indicator-title body-2-bold-tight">
                {stitched ? "About this data" : datapageData.title.title}
                {!stitched && (
                    <span className="indicator-metadata-box__title-variant">
                        {datapageData.titleVariant}
                    </span>
                )}
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
                primaryTopic={datapageData.primaryTopic}
                title={datapageData.title}
                descriptionProcessing={datapageData.descriptionProcessing}
                license={license}
                faqsSectionId={`${FAQS_SECTION_ID}${idSuffix}`}
                sourcesSectionId={`${DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID}${idSuffix}`}
                processingContentId={processingContentId}
                suppressToggleLogUntilRef={suppressToggleLogUntilRef}
                auxiliaryIndicators={auxiliaryIndicators}
                pageCitation={pageCitation}
                stitched={stitched}
            />
        </>
    )
}

// The stitched replacement for the indicator switcher: one line saying what
// the page covers, then one entry per indicator. `short`/`unit`/`note` are
// only present when that field differs across the indicators (the shared
// value renders once in the pane below).
// "Title." for a title that runs into its description; leaves titles that
// already end in punctuation alone.
const withFinalStop = (title: string): string =>
    /[.!?:]$/.test(title.trim()) ? title : `${title}.`

function StitchedIndicatorList({
    entries,
    datapageData,
    expanderOpen,
    onShowAll,
}: {
    entries: StitchedIndicatorListEntry[]
    datapageData: DataPageDataV2
    expanderOpen: boolean
    /** Opens the box's expander, which reveals the folded entries. */
    onShowAll: () => void
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
    // three while the box is closed, then "+N more indicators", which opens
    // the box; the folded entries belong to the expander's content, like the
    // WYSK remainder, so "Show more" reveals them too and the list needs no
    // control of its own. Folded entries stay in the DOM, hidden, for
    // raw-HTML consumers.
    const SHOW_ALL_UP_TO = 5
    const FOLD_AFTER = 3
    const expanded = entries.length <= SHOW_ALL_UP_TO || expanderOpen
    const nFolded = entries.length - FOLD_AFTER
    const showAll = !expanded && (
        <button
            type="button"
            className="indicator-metadata-box__stitched-list-toggle"
            onClick={onShowAll}
            data-track-note="metadata_box_indicator_list_toggle"
        >
            +{nFolded} more indicators
        </button>
    )
    // The list renders as a meta-expander__prose block so it inherits the
    // WYSK's exact type and spacing and reads as the paragraph before it.
    const blockClass =
        "meta-expander__preview meta-expander__prose indicator-metadata-box__stitched-list"

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
            {showAll && (
                <p className="indicator-metadata-box__stitched-list-more">
                    {showAll}
                </p>
            )}
        </div>
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

    // One <details> ref per indicator pane so the "Show less" button and the
    // open-on-switch behavior can target the active pane's collapsible.
    const detailsRefs = useMemo(
        () =>
            Array.from({ length: indicators.length }, () =>
                createRef<HTMLDetailsElement>()
            ),
        [indicators.length]
    )
    const activeDetailsRef = detailsRefs[safeIndex]

    // Open the collapsible whenever the user switches indicator — the click
    // was a request to *see* that indicator's metadata, so keeping the box
    // collapsed afterwards would hide the very thing they asked for. Skip
    // the initial render so the section doesn't auto-open on page load.
    // Toggles caused by the programmatic open/close below shouldn't be
    // logged as user expands/collapses. <details> fires its toggle event
    // asynchronously, so suppress logging for a short window rather than
    // trying to flag the individual events.
    const suppressToggleLogUntilRef = useRef(0)

    const isFirstActiveIndexRef = useRef(true)
    useEffect(() => {
        if (isFirstActiveIndexRef.current) {
            isFirstActiveIndexRef.current = false
            return
        }
        suppressToggleLogUntilRef.current = Date.now() + 500
        // Close the now-hidden panes' collapsibles — a hidden-but-open
        // <details> would keep the box's "Show less" affordance visible
        // (via the `:has([open])` rule) even when the active pane is
        // collapsed.
        detailsRefs.forEach((ref, i) => {
            if (i !== safeIndex && ref.current) ref.current.open = false
        })
        const details = detailsRefs[safeIndex]?.current
        if (details) details.open = true
    }, [safeIndex, detailsRefs])

    // ALL indicators' panes sit in the rendered HTML at the same time — only
    // the active one is visible (display: contents vs display: none), while
    // the others stay available to AI agents / unmodified-HTML consumers on
    // a plain GET.
    const panes = indicators.map((ind, i) => (
        <div
            key={i}
            className={cx("indicator-metadata-box__pane", {
                "indicator-metadata-box__pane--active": i === safeIndex,
            })}
            data-indicator-index={i}
            aria-hidden={i !== safeIndex}
        >
            <IndicatorPaneContent
                datapageData={ind.datapageData}
                faqEntries={ind.faqEntries}
                detailsRef={detailsRefs[i]}
                canonicalUrl={canonicalUrl}
                archiveContext={archiveContext}
                license={license}
                idSuffix={i === safeIndex ? "" : `--${i}`}
                suppressToggleLogUntilRef={suppressToggleLogUntilRef}
                stitched={stitched}
                auxiliaryIndicators={
                    hasSwitcher ? undefined : auxiliaryIndicators
                }
                pageCitation={pageCitation}
            />
        </div>
    ))

    const showLessButton = (
        <button
            type="button"
            className="indicator-metadata-box__show-less"
            onClick={() => {
                if (activeDetailsRef.current)
                    activeDetailsRef.current.open = false
            }}
        >
            Show less
            <FontAwesomeIcon
                icon={faChevronUp}
                className="indicator-metadata-box__chevron"
            />
        </button>
    )

    if (!isMultiIndicator) {
        return (
            <div className={cx("indicator-metadata-box", className)} id={id}>
                {showLessButton}
                {panes}
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
                // Mobile control: pills wrap into a ragged stack of rows
                // on narrow screens, so below the small breakpoint the
                // pill row is hidden and this select takes its own row
                // under the label. Both live in the DOM and CSS picks one
                // (the site pattern for responsive component swaps, e.g.
                // SiteNavigation's mobile menu) — SSR can't know the
                // viewport, so a JS swap would flash on mobile.
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
            {hasSwitcher &&
                auxiliaryIndicators && (
                    // Switcher pages: the size/colour line belongs to the chart,
                    // not to any one pane, so it sits under "About this data"
                    // and the pills, on top of the box.
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
                <div className="indicator-metadata-box">
                    {showLessButton}
                    {panes}
                </div>
            </div>
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
        <dl className="meta-description-table indicator-metadata-box__auxiliary">
            {indicators.map((ind) => (
                <div className="meta-description-table__pair" key={ind.role}>
                    <dt className="meta-description-table__key">
                        {AUXILIARY_LINE_LABEL[ind.role]}
                    </dt>
                    <dd className="meta-description-table__value">
                        <AuxiliaryIndicatorLink indicator={ind} />
                    </dd>
                </div>
            ))}
        </dl>
    )
}
