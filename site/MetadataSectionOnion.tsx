import { ReactNode, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import * as _ from "lodash-es"
import cx from "classnames"
import {
    faChevronDown,
    faChevronUp,
    faArrowDown,
    faCaretDown,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import dayjs from "dayjs"
import {
    DATAPAGE_ABOUT_THIS_DATA_SECTION_ID,
    DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID,
    ExpandableToggle,
    CodeSnippet,
    DataCitation,
    makeLastUpdated,
    makeNextUpdate,
    makeDateRange,
    makeUnit,
} from "@ourworldindata/components"
import {
    AdditionalIndicator,
    ArchiveContext,
    DataPageDataV2,
    DisplaySource,
    FaqEntryData,
    OwidEnrichedGdocBlock,
} from "@ourworldindata/types"
import {
    prepareSourcesForDisplay,
    getCitationShort,
    getCitationLong,
    excludeUndefined,
    getPhraseForArchivalDate,
    spansToUnformattedPlainText,
} from "@ourworldindata/utils"
import { ArticleBlocks } from "./gdocs/components/ArticleBlocks.js"
import DetailedDetailsOnDemand from "./DetailedDetailsOnDemand.js"
import {
    MetadataMarkdownText,
    MetadataHtmlOrSimpleMarkdownText,
    MetadataSingleSource,
} from "./MetadataMarkdownText.js"

// Anchor ids for in-page navigation. The grapher's "Cite" action button
// scrolls to CITATION_GUIDANCE_ID; the inline "Learn more in the FAQs" link
// scrolls to FAQS_ID; and the "Source" callout (when used) scrolls to the
// shared DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID.
const CITATION_GUIDANCE_ID = "citation-guidance"
const FAQS_ID = "faqs"

type FaqGroup = { question: string; body: OwidEnrichedGdocBlock[] }

// Flatten "expandable-paragraph" blocks into their inner items so the FAQ
// answers render in full instead of with a "Show more" truncation —
// once the user has expanded a question, they've already opted in to read
// the whole answer.
const flattenExpandableParagraphs = (
    blocks: OwidEnrichedGdocBlock[]
): OwidEnrichedGdocBlock[] =>
    blocks.flatMap((block) =>
        block.type === "expandable-paragraph" ? block.items : [block]
    )

const groupFaqsByHeading = (
    blocks: OwidEnrichedGdocBlock[]
): { groups: FaqGroup[]; preamble: OwidEnrichedGdocBlock[] } => {
    const groups: FaqGroup[] = []
    const preamble: OwidEnrichedGdocBlock[] = []
    let current: FaqGroup | null = null
    for (const block of blocks) {
        if (block.type === "heading") {
            current = {
                question: spansToUnformattedPlainText(block.text),
                body: [],
            }
            groups.push(current)
        } else if (current) {
            current.body.push(block)
        } else {
            preamble.push(block)
        }
    }
    return {
        groups: groups.map((g) => ({
            ...g,
            body: flattenExpandableParagraphs(g.body),
        })),
        preamble: flattenExpandableParagraphs(preamble),
    }
}

const StatItem = ({
    title,
    value,
    expandedOnly = false,
}: {
    title: ReactNode
    value: ReactNode
    expandedOnly?: boolean
}) => (
    <div
        className={cx("MetadataSectionOnion__summary-stat", {
            "MetadataSectionOnion__summary-stat--expanded-only": expandedOnly,
        })}
    >
        <span className="MetadataSectionOnion__summary-stat-title">
            {title}
        </span>
        <span className="MetadataSectionOnion__summary-stat-value">
            {value}
        </span>
    </div>
)

const OnionSummaryStats = ({
    datapageData,
}: {
    datapageData: DataPageDataV2
}) => {
    const lastUpdated = makeLastUpdated(datapageData)
    const nextUpdate = makeNextUpdate(datapageData)
    const dateRange = makeDateRange(datapageData)
    const unit = makeUnit(datapageData)

    return (
        <>
            {unit && <StatItem title="Unit" value={unit} />}
            {lastUpdated && (
                <StatItem title="Last updated" value={lastUpdated} />
            )}
            {nextUpdate && (
                <StatItem
                    title="Next expected update"
                    value={nextUpdate}
                    expandedOnly={true}
                />
            )}
            {dateRange && <StatItem title="Date range" value={dateRange} />}
        </>
    )
}

// Hardcoded until the author wiring lands; see
// docs/datapage-author-infrastructure.md for the planned propagation
// (variables.authors → datasets.authors → DataPageDataV2.authors) and the
// React swap to LinkedAuthor once linkedAuthors flow through
// AttachmentsContext.
const PLACEHOLDER_AUTHOR_NAMES = ["Veronika Samborska"]

const getInitials = (name: string): string =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() ?? "")
        .join("")

const OnionAuthorChip = ({ name }: { name: string }) => (
    <a
        className="MetadataSectionOnion__author-chip"
        href={`/team/${_.kebabCase(name)}`}
        title={name}
    >
        <span
            className="MetadataSectionOnion__author-thumbnail"
            aria-hidden="true"
        >
            {getInitials(name)}
        </span>
        <span className="MetadataSectionOnion__author-name">{name}</span>
    </a>
)

const OnionManagedByItem = ({ authorNames }: { authorNames: string[] }) => {
    if (!authorNames.length) return null
    return (
        <StatItem
            title="Managed by"
            value={
                <span className="MetadataSectionOnion__managed-by-authors">
                    {authorNames.map((name) => (
                        <OnionAuthorChip key={name} name={name} />
                    ))}
                </span>
            }
        />
    )
}

const labelForIndicator = (datapageData: DataPageDataV2): string => {
    const title = datapageData.title.title
    const variant = datapageData.titleVariant
    return variant && !title.includes(variant) ? `${title} – ${variant}` : title
}

// Feature flag for which indicator-switcher UI to render on multi-indicator
// data pages. Override per-request via the URL query string,
// e.g. `?switcher=h-tabs` or `?switcher=v-tabs`.
export type SwitcherVariant = "dropdown" | "h-tabs" | "v-tabs"
const DEFAULT_SWITCHER_VARIANT: SwitcherVariant = "h-tabs"
const ALL_SWITCHER_VARIANTS: readonly SwitcherVariant[] = [
    "dropdown",
    "h-tabs",
    "v-tabs",
]

const useSwitcherVariant = (): SwitcherVariant => {
    const [variant, setVariant] = useState<SwitcherVariant>(
        DEFAULT_SWITCHER_VARIANT
    )
    useEffect(() => {
        if (typeof window === "undefined") return
        const sp = new URLSearchParams(window.location.search)
        const v = sp.get("switcher")
        if (v && ALL_SWITCHER_VARIANTS.includes(v as SwitcherVariant)) {
            setVariant(v as SwitcherVariant)
        }
    }, [])
    return variant
}

type IndicatorEntry = { datapageData: DataPageDataV2 }

// Label that sits next to (or above) the indicator switcher. Renders as
// "ABOUT THIS DATA (3 indicators)" or just "ABOUT THIS DATA" in the
// single-indicator case. Used by all three switcher variants — the
// shared component keeps the wording + counting logic in one place.
const OnionIndicatorAboutLabel = ({
    indicatorCount,
    className,
}: {
    indicatorCount: number
    className?: string
}) => (
    <span
        className={cx(
            "MetadataSectionOnion__indicator-header-group",
            className
        )}
    >
        <span className="MetadataSectionOnion__indicator-title-prefix">
            About this data
        </span>
        {indicatorCount > 1 && (
            <span className="MetadataSectionOnion__indicator-count">
                ({indicatorCount} indicators)
            </span>
        )}
    </span>
)

// Cap on how many tab buttons render before the rest collapse into a
// "More ▾" overflow dropdown. With many-indicator charts (e.g.
// annual-number-of-deaths-by-cause has ~30) an uncapped tab row gets
// unwieldy in both horizontal and vertical layouts. Mobile h-tabs use a
// lower cap because the row wraps too aggressively otherwise.
const MAX_VISIBLE_TABS_DESKTOP = 5
const MAX_VISIBLE_TABS_MOBILE = 3

// Matches the SCSS `@media (max-width: 767px)` breakpoint used elsewhere
// in this component (e.g. the v-tabs responsive stack).
const MOBILE_MEDIA_QUERY = "(max-width: 767px)"

const useIsMobile = (): boolean => {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia(MOBILE_MEDIA_QUERY)
        const update = () => setIsMobile(mq.matches)
        update()
        mq.addEventListener("change", update)
        return () => mq.removeEventListener("change", update)
    }, [])
    return isMobile
}

const splitForOverflow = (
    indicators: IndicatorEntry[],
    max: number
): {
    visible: IndicatorEntry[]
    overflow: IndicatorEntry[]
    overflowStartIndex: number
} => {
    if (indicators.length <= max) {
        return {
            visible: indicators,
            overflow: [],
            overflowStartIndex: indicators.length,
        }
    }
    const visibleCount = max - 1
    return {
        visible: indicators.slice(0, visibleCount),
        overflow: indicators.slice(visibleCount),
        overflowStartIndex: visibleCount,
    }
}

// Position a fixed popover anchored to a trigger button, with outside-click
// + Esc dismissal and reflow on scroll/resize. Shared by the dropdown
// variant and the tabs' overflow "More" menu.
const usePopoverAnchor = (
    triggerRef: React.RefObject<HTMLElement | null>,
    popoverRef: React.RefObject<HTMLElement | null>,
    open: boolean,
    setOpen: (o: boolean) => void,
    { matchTriggerWidth = false }: { matchTriggerWidth?: boolean } = {}
): React.CSSProperties => {
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
    useEffect(() => {
        if (!open) return
        const updatePos = () => {
            if (!triggerRef.current) return
            const r = triggerRef.current.getBoundingClientRect()
            setPopoverStyle({
                position: "fixed",
                top: r.bottom + 4,
                left: r.left,
                ...(matchTriggerWidth ? { minWidth: r.width } : {}),
            })
        }
        updatePos()
        const onDocMouseDown = (e: MouseEvent) => {
            const target = e.target as Node
            if (
                popoverRef.current?.contains(target) ||
                triggerRef.current?.contains(target)
            )
                return
            setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false)
        }
        document.addEventListener("mousedown", onDocMouseDown)
        document.addEventListener("keydown", onKey)
        window.addEventListener("scroll", updatePos, true)
        window.addEventListener("resize", updatePos)
        return () => {
            document.removeEventListener("mousedown", onDocMouseDown)
            document.removeEventListener("keydown", onKey)
            window.removeEventListener("scroll", updatePos, true)
            window.removeEventListener("resize", updatePos)
        }
    }, [open, triggerRef, popoverRef, setOpen, matchTriggerWidth])
    return popoverStyle
}

const OnionIndicatorDropdown = ({
    activeDatapageData,
    indicators,
    activeIndex,
    onIndicatorChange,
}: {
    activeDatapageData: DataPageDataV2
    indicators: IndicatorEntry[]
    activeIndex: number
    onIndicatorChange: (i: number) => void
}) => {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)
    const popoverStyle = usePopoverAnchor(
        triggerRef,
        popoverRef,
        open,
        setOpen,
        {
            matchTriggerWidth: true,
        }
    )

    const indicatorTitle = activeDatapageData.title.title
    if (!indicatorTitle) return null
    const titleVariant = activeDatapageData.titleVariant?.trim()

    return (
        <>
            <OnionIndicatorAboutLabel indicatorCount={indicators.length} />
            <button
                type="button"
                ref={triggerRef}
                className="MetadataSectionOnion__indicator-title-trigger"
                aria-expanded={open}
                aria-haspopup="listbox"
                data-track-note="metadata-onion-indicator-switch"
                onClick={() => setOpen((o) => !o)}
            >
                <span className="MetadataSectionOnion__indicator-title">
                    {indicatorTitle}
                </span>
                <FontAwesomeIcon
                    icon={faCaretDown}
                    className="MetadataSectionOnion__indicator-title-caret"
                />
            </button>
            {titleVariant && (
                <span className="MetadataSectionOnion__indicator-title-variant">
                    {titleVariant}
                </span>
            )}
            {open &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={popoverRef}
                        className="MetadataSectionOnion__indicator-title-popover"
                        style={popoverStyle}
                        role="listbox"
                    >
                        {indicators.map((ind, i) => (
                            <button
                                type="button"
                                key={i}
                                role="option"
                                aria-selected={i === activeIndex}
                                className={cx(
                                    "MetadataSectionOnion__indicator-title-option",
                                    {
                                        "MetadataSectionOnion__indicator-title-option--active":
                                            i === activeIndex,
                                    }
                                )}
                                onClick={() => {
                                    onIndicatorChange(i)
                                    setOpen(false)
                                }}
                            >
                                {labelForIndicator(ind.datapageData)}
                            </button>
                        ))}
                    </div>,
                    document.body
                )}
        </>
    )
}

// Renders the overflow "More ▾" trigger + its popover. The trigger reads
// as a normal tab button (so it sits inline with the rest of the tab row)
// and inherits its baseClassName + activeClassName from the parent variant.
const OnionIndicatorMoreDropdown = ({
    overflow,
    overflowStartIndex,
    activeIndex,
    onIndicatorChange,
    baseClassName,
    activeClassName,
}: {
    overflow: IndicatorEntry[]
    overflowStartIndex: number
    activeIndex: number
    onIndicatorChange: (i: number) => void
    baseClassName: string
    activeClassName: string
}) => {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)
    const popoverStyle = usePopoverAnchor(triggerRef, popoverRef, open, setOpen)
    const isActiveInOverflow = activeIndex >= overflowStartIndex
    const label = isActiveInOverflow
        ? labelForIndicator(
              overflow[activeIndex - overflowStartIndex].datapageData
          )
        : "More"
    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-expanded={open}
                aria-haspopup="listbox"
                className={cx(baseClassName, `${baseClassName}--more`, {
                    [activeClassName]: isActiveInOverflow,
                })}
                onClick={() => setOpen((o) => !o)}
                data-track-note="metadata-onion-indicator-switch"
            >
                {label}
                <FontAwesomeIcon
                    icon={faCaretDown}
                    className="MetadataSectionOnion__indicator-title-caret"
                />
            </button>
            {open &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={popoverRef}
                        className="MetadataSectionOnion__indicator-title-popover"
                        style={popoverStyle}
                        role="listbox"
                    >
                        {overflow.map((ind, i) => {
                            const idx = overflowStartIndex + i
                            return (
                                <button
                                    type="button"
                                    key={idx}
                                    role="option"
                                    aria-selected={idx === activeIndex}
                                    className={cx(
                                        "MetadataSectionOnion__indicator-title-option",
                                        {
                                            "MetadataSectionOnion__indicator-title-option--active":
                                                idx === activeIndex,
                                        }
                                    )}
                                    onClick={() => {
                                        onIndicatorChange(idx)
                                        setOpen(false)
                                    }}
                                >
                                    {labelForIndicator(ind.datapageData)}
                                </button>
                            )
                        })}
                    </div>,
                    document.body
                )}
        </>
    )
}

const OnionIndicatorTabsHorizontal = ({
    indicators,
    activeIndex,
    onIndicatorChange,
}: {
    indicators: IndicatorEntry[]
    activeIndex: number
    onIndicatorChange: (i: number) => void
}) => {
    const isMobile = useIsMobile()
    const { visible, overflow, overflowStartIndex } = splitForOverflow(
        indicators,
        isMobile ? MAX_VISIBLE_TABS_MOBILE : MAX_VISIBLE_TABS_DESKTOP
    )
    return (
        <div
            className="MetadataSectionOnion__h-tabs"
            role="tablist"
            aria-label="About this data"
        >
            {visible.map((ind, i) => (
                <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === activeIndex}
                    className={cx("MetadataSectionOnion__h-tab", {
                        "MetadataSectionOnion__h-tab--active":
                            i === activeIndex,
                    })}
                    onClick={() => onIndicatorChange(i)}
                    data-track-note="metadata-onion-indicator-switch"
                >
                    {labelForIndicator(ind.datapageData)}
                </button>
            ))}
            {overflow.length > 0 && (
                <OnionIndicatorMoreDropdown
                    overflow={overflow}
                    overflowStartIndex={overflowStartIndex}
                    activeIndex={activeIndex}
                    onIndicatorChange={onIndicatorChange}
                    baseClassName="MetadataSectionOnion__h-tab"
                    activeClassName="MetadataSectionOnion__h-tab--active"
                />
            )}
        </div>
    )
}

const OnionIndicatorTabsVertical = ({
    indicators,
    activeIndex,
    onIndicatorChange,
}: {
    indicators: IndicatorEntry[]
    activeIndex: number
    onIndicatorChange: (i: number) => void
}) => {
    const { visible, overflow, overflowStartIndex } = splitForOverflow(
        indicators,
        MAX_VISIBLE_TABS_DESKTOP
    )
    return (
        <aside
            className="MetadataSectionOnion__v-tabs"
            role="tablist"
            aria-orientation="vertical"
            aria-label="Indicator"
        >
            <OnionIndicatorAboutLabel
                indicatorCount={indicators.length}
                className="MetadataSectionOnion__v-tabs-label"
            />
            {visible.map((ind, i) => (
                <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === activeIndex}
                    className={cx("MetadataSectionOnion__v-tab", {
                        "MetadataSectionOnion__v-tab--active":
                            i === activeIndex,
                    })}
                    onClick={() => onIndicatorChange(i)}
                    data-track-note="metadata-onion-indicator-switch"
                >
                    {labelForIndicator(ind.datapageData)}
                </button>
            ))}
            {overflow.length > 0 && (
                <OnionIndicatorMoreDropdown
                    overflow={overflow}
                    overflowStartIndex={overflowStartIndex}
                    activeIndex={activeIndex}
                    onIndicatorChange={onIndicatorChange}
                    baseClassName="MetadataSectionOnion__v-tab"
                    activeClassName="MetadataSectionOnion__v-tab--active"
                />
            )}
        </aside>
    )
}

// "What you should know" key takeaways, rendered inside <summary> so the
// preview is visible in both collapsed and expanded states (clipped + faded
// when collapsed via CSS). A single bullet renders as a paragraph; multiple
// bullets render as a <ul>.
const OnionDescriptionKey = ({
    descriptionKey,
    sourcesForDisplay,
}: {
    descriptionKey: string[]
    sourcesForDisplay: DisplaySource[]
}) => {
    if (descriptionKey.length === 0) return null
    const body =
        descriptionKey.length === 1 ? (
            <MetadataMarkdownText
                text={descriptionKey[0].trim()}
                sources={sourcesForDisplay}
            />
        ) : (
            <ul>
                {descriptionKey.map((text, i) => (
                    <li key={i}>
                        <MetadataMarkdownText
                            text={text.trim()}
                            useParagraphs={false}
                            sources={sourcesForDisplay}
                        />
                    </li>
                ))}
            </ul>
        )
    return (
        <section className="MetadataSectionOnion__description-key">
            <div className="key-info__key-description">{body}</div>
        </section>
    )
}

const OnionShortDescription = ({
    datapageData,
    sourcesForDisplay,
}: {
    datapageData: DataPageDataV2
    sourcesForDisplay: DisplaySource[]
}) => {
    if (!datapageData.descriptionShort) return null
    return (
        <div className="MetadataSectionOnion__short-description">
            <span className="MetadataSectionOnion__short-description-label">
                Short description
            </span>
            <span className="MetadataSectionOnion__short-description-text">
                <MetadataMarkdownText
                    text={datapageData.descriptionShort}
                    useParagraphs={false}
                    sources={sourcesForDisplay}
                />
            </span>
        </div>
    )
}

const OnionProcessingNotesCallout = ({
    descriptionProcessing,
    sourcesForDisplay,
}: {
    descriptionProcessing: string
    sourcesForDisplay: DisplaySource[]
}) => (
    <section className="MetadataSectionOnion__processing-notes">
        <h3 className="MetadataSectionOnion__section-heading MetadataSectionOnion__section-heading--minor">
            How we processed this indicator
        </h3>
        <div className="MetadataSectionOnion__processing-notes-body">
            <MetadataHtmlOrSimpleMarkdownText
                text={descriptionProcessing.trim()}
                sources={sourcesForDisplay}
            />
        </div>
    </section>
)

const OnionFaqsSection = ({
    faqEntries,
    anchorId,
}: {
    faqEntries: FaqEntryData
    anchorId: string
}) => {
    const { groups, preamble } = groupFaqsByHeading(faqEntries.faqs)
    if (!groups.length && !preamble.length) return null
    return (
        <section className="MetadataSectionOnion__faqs">
            <h3
                className="MetadataSectionOnion__section-heading MetadataSectionOnion__section-heading--minor"
                id={anchorId}
            >
                Frequently Asked Questions
            </h3>
            {preamble.length > 0 && (
                <div className="MetadataSectionOnion__faqs-preamble">
                    <ArticleBlocks blocks={preamble} containerType="datapage" />
                </div>
            )}
            <div className="MetadataSectionOnion__faqs-items">
                {groups.map((group, i) => (
                    <ExpandableToggle
                        key={`${group.question}-${i}`}
                        label={group.question}
                        content={
                            <ArticleBlocks
                                blocks={group.body}
                                containerType="datapage"
                            />
                        }
                        isStacked={i < groups.length - 1}
                    />
                ))}
            </div>
        </section>
    )
}

const OnionDataSourcesList = ({
    sources,
    anchorId,
}: {
    sources: DisplaySource[]
    anchorId: string
}) => {
    if (sources.length === 0) return null
    const heading = sources.length === 1 ? "Data source" : "Data sources"
    return (
        <section
            className="MetadataSectionOnion__sources-section"
            id={anchorId}
        >
            <h3 className="MetadataSectionOnion__section-heading">{heading}</h3>
            <div className="MetadataSectionOnion__sources-list">
                {sources.map((source, i) => (
                    <ExpandableToggle
                        key={`${source.label}-${i}`}
                        label={source.label}
                        content={<MetadataSingleSource source={source} />}
                        isStacked={i < sources.length - 1}
                    />
                ))}
            </div>
        </section>
    )
}

// Static copy explaining OWID's general data-processing approach. Rendered
// inside the citation guidance "(We've processed this data)" modal trigger.
const OwidProcessingBlurb = () => (
    <div className="indicator-processing">
        <div className="data-processing">
            <p>
                All data and visualizations on Our World in Data rely on data
                sourced from one or several original data providers. Preparing
                this original data involves several processing steps. Depending
                on the data, this can include standardizing country names and
                world region definitions, converting units, calculating derived
                indicators such as per capita measures, as well as adding or
                adapting metadata such as the name or the description given to
                an indicator.
            </p>
            <p>
                At the link below you can find a detailed description of the
                structure of our data pipeline, including links to all the code
                used to prepare data across Our World in Data.
            </p>
        </div>
        <a
            href="https://docs.owid.io/projects/etl/"
            className="indicator-processing__link"
        >
            Read about our data pipeline
            <FontAwesomeIcon icon={faArrowDown} />
        </a>
    </div>
)

const OnionCitationGuidance = ({
    anchorId,
    citationShort,
    citationLong,
    citationDatapage,
}: {
    anchorId: string
    citationShort: string
    citationLong: string
    citationDatapage: string
}) => {
    return (
        <section
            className="MetadataSectionOnion__citation-guidance"
            id={anchorId}
        >
            <h3 className="MetadataSectionOnion__section-heading">
                How to cite
            </h3>
            <p className="MetadataSectionOnion__citation-lead">
                <DetailedDetailsOnDemand
                    title="How we process data at Our World in Data"
                    triggerText="We&rsquo;ve processed this data"
                    triggerClassName="MetadataSectionOnion__citation-how-trigger"
                >
                    <OwidProcessingBlurb />
                </DetailedDetailsOnDemand>
                , so you need to mention both us and the original source.
            </p>
            <div className="MetadataSectionOnion__citation-toggles">
                {citationShort && (
                    <ExpandableToggle
                        label="How should I cite this data in a news article?"
                        content={
                            <DataCitation
                                citationLong=""
                                citationShort={citationShort}
                            />
                        }
                        isStacked={!!(citationDatapage || citationLong)}
                    />
                )}
                {(citationDatapage || citationLong) && (
                    <ExpandableToggle
                        label="How should I cite this data in an academic article or report?"
                        content={
                            <div className="citations-section">
                                {citationDatapage && (
                                    <>
                                        <p className="citation__paragraph">
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
                                )}
                                {citationLong && (
                                    <>
                                        <p className="citation__paragraph">
                                            To cite the underlying data sources
                                            directly, use the following
                                            citation:
                                        </p>
                                        <CodeSnippet
                                            code={citationLong}
                                            theme="light"
                                            useMarkdown={true}
                                        />
                                    </>
                                )}
                            </div>
                        }
                    />
                )}
            </div>
            <ul className="MetadataSectionOnion__license-blurb">
                <li>
                    All data produced by third-party providers and made
                    available by Our World in Data are subject to the license
                    terms from the original providers. Our work would not be
                    possible without the data providers we rely on, so we ask
                    you to always cite them appropriately (see below). This is
                    crucial to allow data providers to continue doing their
                    work, enhancing, maintaining and updating valuable data.
                </li>
                <li>
                    All data, visualizations, and code produced by Our World in
                    Data are completely open access under the{" "}
                    <a
                        href="https://creativecommons.org/licenses/by/4.0/"
                        className="reuse__link"
                    >
                        Creative Commons BY license
                    </a>
                    . You have the permission to use, distribute, and reproduce
                    these in any medium, provided the source and authors are
                    credited.
                </li>
            </ul>
        </section>
    )
}

export default function MetadataSectionOnion({
    className,
    datapageData: primaryDatapageData,
    additionalIndicators,
    faqEntries: primaryFaqEntries,
    canonicalUrl,
    archiveContext,
}: {
    className?: string
    datapageData: DataPageDataV2
    additionalIndicators?: AdditionalIndicator[]
    faqEntries?: FaqEntryData
    canonicalUrl: string
    archiveContext?: ArchiveContext
}) {
    const indicators: {
        datapageData: DataPageDataV2
        faqEntries?: FaqEntryData
    }[] = [
        { datapageData: primaryDatapageData, faqEntries: primaryFaqEntries },
        ...(additionalIndicators ?? []),
    ]
    const [activeIndex, setActiveIndex] = useState(0)
    // Guard against the active indicator being unmounted between renders (e.g.
    // if the upstream data shrinks). Falls back to the primary indicator.
    const safeIndex = Math.min(Math.max(activeIndex, 0), indicators.length - 1)
    const active = indicators[safeIndex]
    const datapageData = active.datapageData
    const faqEntries = active.faqEntries
    const isMulti = indicators.length > 1
    const switcherVariant = useSwitcherVariant()
    const indicatorTitle = datapageData.title.title
    const titleVariant = datapageData.titleVariant?.trim()

    // Open the collapsible whenever the user switches indicator — the click
    // was a request to *see* that indicator's metadata, so keeping the box
    // collapsed afterwards would hide the very thing they asked for. Skip
    // the initial render so the section doesn't auto-open on page load.
    const detailsRef = useRef<HTMLDetailsElement>(null)
    const isFirstActiveIndexRef = useRef(true)
    useEffect(() => {
        if (isFirstActiveIndexRef.current) {
            isFirstActiveIndexRef.current = false
            return
        }
        if (detailsRef.current) detailsRef.current.open = true
    }, [safeIndex])

    const producers = _.uniq(datapageData.origins.map((o) => `${o.producer}`))
    // Dedupe by label: multi-Y charts often share origins across indicators
    // (e.g. children-per-woman-un has one UN WPP origin per Y variable),
    // which would otherwise render the same source 10+ times in the Data
    // sources list.
    const sourcesForDisplay = _.uniqBy(
        prepareSourcesForDisplay({
            origins: datapageData.origins,
            source: datapageData.source,
        }),
        "label"
    )
    const citationUrl = archiveContext?.archiveUrl ?? canonicalUrl
    const citationShort = getCitationShort(
        datapageData.origins,
        datapageData.attributions,
        datapageData.owidProcessingLevel
    )
    const citationLong = getCitationLong(
        datapageData.title,
        datapageData.origins,
        datapageData.source,
        datapageData.attributions,
        datapageData.attributionShort,
        datapageData.titleVariant,
        datapageData.owidProcessingLevel,
        citationUrl,
        archiveContext?.archivalDate
    )
    const currentYear = dayjs().year()
    const adaptedFrom =
        producers.length > 0 ? producers.join(", ") : datapageData.source?.name
    const maybeAddPeriod = (s: string) =>
        s.endsWith("?") || s.endsWith(".") ? s : `${s}.`
    const primaryTopicCitation = maybeAddPeriod(
        datapageData.primaryTopic?.citation ?? ""
    )
    const archivalString = getPhraseForArchivalDate(
        archiveContext?.archivalDate
    )
    const citationDatapage = excludeUndefined([
        datapageData.primaryTopic
            ? `“Data Page: ${datapageData.title.title}”, part of the following publication: ${primaryTopicCitation}`
            : `“Data Page: ${datapageData.title.title}”. Our World in Data (${currentYear}).`,
        adaptedFrom ? `Data adapted from ${adaptedFrom}.` : undefined,
        `Retrieved from ${citationUrl} [online resource]${
            archivalString ? ` ${archivalString}` : ""
        }`,
    ]).join(" ")
    const renderHeaderSwitcher = () => {
        if (!isMulti) {
            return (
                <>
                    {indicatorTitle && (
                        <span className="MetadataSectionOnion__indicator-title">
                            {indicatorTitle}
                        </span>
                    )}
                    {titleVariant && (
                        <span className="MetadataSectionOnion__indicator-title-variant">
                            {titleVariant}
                        </span>
                    )}
                </>
            )
        }
        if (switcherVariant === "dropdown") {
            return (
                <OnionIndicatorDropdown
                    activeDatapageData={datapageData}
                    indicators={indicators}
                    activeIndex={safeIndex}
                    onIndicatorChange={setActiveIndex}
                />
            )
        }
        if (switcherVariant === "h-tabs") {
            return (
                <>
                    <OnionIndicatorAboutLabel
                        indicatorCount={indicators.length}
                    />
                    <OnionIndicatorTabsHorizontal
                        indicators={indicators}
                        activeIndex={safeIndex}
                        onIndicatorChange={setActiveIndex}
                    />
                    {titleVariant && (
                        <span className="MetadataSectionOnion__indicator-title-variant">
                            {titleVariant}
                        </span>
                    )}
                </>
            )
        }
        // v-tabs: the tab list lives beside the box; only the variant text
        // (if any) shows in the header row.
        return titleVariant ? (
            <span className="MetadataSectionOnion__indicator-title-variant">
                {titleVariant}
            </span>
        ) : null
    }

    // The v-tabs aside renders the switcher beside the box, so no need for a
    // header strip above the row. For dropdown / h-tabs we pull the TLDR
    // bits (short description + factoids) up into the header so users can
    // tell at a glance what the box hides.
    const showInlineHeader = !(isMulti && switcherVariant === "v-tabs")
    const renderTldr = () => (
        <>
            <OnionShortDescription
                datapageData={datapageData}
                sourcesForDisplay={sourcesForDisplay}
            />
            <div className="MetadataSectionOnion__factoids">
                <OnionSummaryStats datapageData={datapageData} />
                <OnionManagedByItem authorNames={PLACEHOLDER_AUTHOR_NAMES} />
            </div>
        </>
    )
    const collapse = () => {
        if (detailsRef.current) detailsRef.current.open = false
    }
    // Expand when the user clicks anywhere on the wrap (outside an
    // interactive child like a tab button or link) while collapsed. Pairs
    // with the wrap-wide hover styling so the whole component reads as
    // clickable, not just the <summary>. Skip clicks inside <summary> —
    // the <details>/<summary> native toggle already handles those, and
    // setting `open = true` here would race with the native toggle and
    // leave the box closed.
    const onWrapClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!detailsRef.current || detailsRef.current.open) return
        const target = e.target as HTMLElement
        if (target.closest("button, a, input, select, textarea, label")) return
        if (target.closest("summary")) return
        detailsRef.current.open = true
    }
    // Summary click handler. React onClick fires before the native
    // <details> toggle, so `details.open` here reflects the state *before*
    // the click. We let native handle expand (collapsed → open), and
    // preventDefault on expand (open → collapsed) so reading the summary
    // body doesn't accidentally close the section — collapsing is only
    // done via the "Show less" bar or the top-right chevron.
    const onSummaryClick = (e: React.MouseEvent<HTMLElement>) => {
        // Keyboard-triggered clicks have detail === 0; let those toggle
        // normally so keyboard UX matches the native <details> behaviour.
        if (e.detail === 0) return
        if (!detailsRef.current?.open) return
        e.preventDefault()
    }
    return (
        <div
            className={cx(
                "MetadataSectionOnion-wrap",
                `MetadataSectionOnion-wrap--${switcherVariant}`,
                { "MetadataSectionOnion-wrap--no-above": !showInlineHeader },
                className
            )}
            onClick={onWrapClick}
        >
            <button
                type="button"
                className="MetadataSectionOnion__top-collapse"
                aria-label="Show less"
                onClick={collapse}
            >
                <span className="MetadataSectionOnion__top-collapse-label">
                    Show less
                </span>
                <FontAwesomeIcon icon={faChevronUp} />
            </button>
            {showInlineHeader && (
                <header className="MetadataSectionOnion__above">
                    <div className="MetadataSectionOnion__above-switcher">
                        {renderHeaderSwitcher()}
                    </div>
                    {renderTldr()}
                </header>
            )}
            <div className="MetadataSectionOnion__main">
                {isMulti && switcherVariant === "v-tabs" && (
                    <OnionIndicatorTabsVertical
                        indicators={indicators}
                        activeIndex={safeIndex}
                        onIndicatorChange={setActiveIndex}
                    />
                )}
                <details ref={detailsRef} className="MetadataSectionOnion">
                    <summary
                        className="MetadataSectionOnion__summary"
                        onClick={onSummaryClick}
                    >
                        <div className="MetadataSectionOnion__summary-key-data">
                            {!showInlineHeader && renderTldr()}
                            <OnionDescriptionKey
                                descriptionKey={
                                    datapageData.descriptionKey ?? []
                                }
                                sourcesForDisplay={sourcesForDisplay}
                            />
                            <span className="MetadataSectionOnion__toggle MetadataSectionOnion__toggle--show-more">
                                Show more
                                <FontAwesomeIcon
                                    className="MetadataSectionOnion__icon"
                                    icon={faChevronDown}
                                />
                            </span>
                        </div>
                    </summary>

                    <div
                        className="MetadataSectionOnion__content"
                        id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                    >
                        {faqEntries && (
                            <OnionFaqsSection
                                faqEntries={faqEntries}
                                anchorId={FAQS_ID}
                            />
                        )}

                        {datapageData.descriptionProcessing && (
                            <OnionProcessingNotesCallout
                                descriptionProcessing={
                                    datapageData.descriptionProcessing
                                }
                                sourcesForDisplay={sourcesForDisplay}
                            />
                        )}

                        <OnionDataSourcesList
                            sources={sourcesForDisplay}
                            anchorId={
                                DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID
                            }
                        />

                        <OnionCitationGuidance
                            anchorId={CITATION_GUIDANCE_ID}
                            citationShort={citationShort}
                            citationLong={citationLong}
                            citationDatapage={citationDatapage}
                        />
                    </div>
                    <button
                        type="button"
                        className="MetadataSectionOnion__toggle MetadataSectionOnion__toggle--show-less"
                        onClick={collapse}
                    >
                        <span className="MetadataSectionOnion__toggle-label">
                            Show less
                            <FontAwesomeIcon
                                className="MetadataSectionOnion__icon MetadataSectionOnion__icon--up"
                                icon={faChevronDown}
                            />
                        </span>
                    </button>
                </details>
            </div>
        </div>
    )
}
