import { ReactNode, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import * as _ from "lodash-es"
import cx from "classnames"
import {
    faChevronDown,
    faChevronUp,
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
    HtmlOrSimpleMarkdownText,
    SimpleMarkdownText,
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
import { MetadataSingleSource } from "./MetadataSingleSource.js"

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

const StatItem = ({ title, value }: { title: ReactNode; value: ReactNode }) => (
    <div className="MetadataSectionCollapsible__summary-stat">
        <span className="MetadataSectionCollapsible__summary-stat-title">
            {title}
        </span>
        <span className="MetadataSectionCollapsible__summary-stat-value">
            {value}
        </span>
    </div>
)

const SummaryStats = ({ datapageData }: { datapageData: DataPageDataV2 }) => {
    const lastUpdated = makeLastUpdated(datapageData)
    const nextUpdate = makeNextUpdate(datapageData)
    const dateRange = makeDateRange(datapageData)
    const unit = makeUnit(datapageData)

    return (
        <>
            {unit && <StatItem title="Unit" value={unit} />}
            {dateRange && <StatItem title="Date range" value={dateRange} />}
            {lastUpdated && (
                <StatItem title="Last updated" value={lastUpdated} />
            )}
            {nextUpdate && (
                <StatItem title="Next expected update" value={nextUpdate} />
            )}
        </>
    )
}

// Wraps a per-indicator slice of the box's content (title, factoid row,
// bullets, sources, etc.) so that ALL indicators' metadata sit in the
// rendered HTML at the same time — only the active one is visible to the
// user (via `display: contents` vs `display: none`), while the others are
// available to AI agents / unmodified-HTML consumers on a plain GET.
const IndicatorPane = ({
    index,
    active,
    children,
}: {
    index: number
    active: boolean
    children: ReactNode
}) => (
    <div
        className={cx("MetadataSectionCollapsible__indicator-pane", {
            "MetadataSectionCollapsible__indicator-pane--active": active,
        })}
        data-indicator-index={index}
        aria-hidden={!active}
    >
        {children}
    </div>
)

const labelForIndicator = (datapageData: DataPageDataV2): string => {
    const title = datapageData.title.title
    const variant = datapageData.titleVariant
    return variant && !title.includes(variant) ? `${title} – ${variant}` : title
}

// Feature flag for which indicator-switcher UI to render on multi-indicator
// data pages. Override per-request via the URL query string,
// e.g. `?switcher=h-tabs` or `?switcher=v-tabs`.
export type SwitcherVariant = "dropdown" | "h-tabs" | "v-tabs" | "h-pills"
const DEFAULT_SWITCHER_VARIANT: SwitcherVariant = "h-pills"
const ALL_SWITCHER_VARIANTS: readonly SwitcherVariant[] = [
    "dropdown",
    "h-tabs",
    "v-tabs",
    "h-pills",
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
const IndicatorAboutLabel = ({
    indicatorCount,
    className,
}: {
    indicatorCount: number
    className?: string
}) => (
    <span
        className={cx(
            "MetadataSectionCollapsible__indicator-header-group",
            className
        )}
    >
        <span className="MetadataSectionCollapsible__indicator-title-prefix">
            About this data
        </span>
        {indicatorCount > 1 && (
            <span className="MetadataSectionCollapsible__indicator-count">
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

const IndicatorDropdown = ({
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
            <IndicatorAboutLabel indicatorCount={indicators.length} />
            <button
                type="button"
                ref={triggerRef}
                className="MetadataSectionCollapsible__indicator-title-trigger"
                aria-expanded={open}
                aria-haspopup="listbox"
                data-track-note="metadata_box_indicator_switch"
                onClick={() => setOpen((o) => !o)}
            >
                <span className="MetadataSectionCollapsible__indicator-title">
                    {indicatorTitle}
                </span>
                <FontAwesomeIcon
                    icon={faCaretDown}
                    className="MetadataSectionCollapsible__indicator-title-caret"
                />
            </button>
            {titleVariant && (
                <span className="MetadataSectionCollapsible__indicator-title-variant">
                    {titleVariant}
                </span>
            )}
            {open &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={popoverRef}
                        className="MetadataSectionCollapsible__indicator-title-popover"
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
                                    "MetadataSectionCollapsible__indicator-title-option",
                                    {
                                        "MetadataSectionCollapsible__indicator-title-option--active":
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
const IndicatorMoreDropdown = ({
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
                data-track-note="metadata_box_indicator_switch"
            >
                {label}
                <FontAwesomeIcon
                    icon={faCaretDown}
                    className="MetadataSectionCollapsible__indicator-title-caret"
                />
            </button>
            {open &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        ref={popoverRef}
                        className="MetadataSectionCollapsible__indicator-title-popover"
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
                                        "MetadataSectionCollapsible__indicator-title-option",
                                        {
                                            "MetadataSectionCollapsible__indicator-title-option--active":
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

const IndicatorTabsHorizontal = ({
    indicators,
    activeIndex,
    onIndicatorChange,
    variant = "tabs",
}: {
    indicators: IndicatorEntry[]
    activeIndex: number
    onIndicatorChange: (i: number) => void
    // "tabs" = underline-tab strip attached to the box (h-tabs variant);
    // "pills" = rounded pill buttons (h-pills variant). Both use the same
    // logic and overflow handling; only the class names differ so the
    // SCSS can style them independently.
    variant?: "tabs" | "pills"
}) => {
    const isMobile = useIsMobile()
    const { visible, overflow, overflowStartIndex } = splitForOverflow(
        indicators,
        isMobile ? MAX_VISIBLE_TABS_MOBILE : MAX_VISIBLE_TABS_DESKTOP
    )
    const containerClass =
        variant === "pills"
            ? "MetadataSectionCollapsible__h-pills"
            : "MetadataSectionCollapsible__h-tabs"
    const itemClass =
        variant === "pills"
            ? "MetadataSectionCollapsible__h-pill"
            : "MetadataSectionCollapsible__h-tab"
    const itemActiveClass =
        variant === "pills"
            ? "MetadataSectionCollapsible__h-pill--active"
            : "MetadataSectionCollapsible__h-tab--active"
    return (
        <div
            className={containerClass}
            role="tablist"
            aria-label="About this data"
        >
            {visible.map((ind, i) => (
                <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === activeIndex}
                    className={cx(itemClass, {
                        [itemActiveClass]: i === activeIndex,
                    })}
                    onClick={() => onIndicatorChange(i)}
                    data-track-note="metadata_box_indicator_switch"
                >
                    {labelForIndicator(ind.datapageData)}
                </button>
            ))}
            {overflow.length > 0 && (
                <IndicatorMoreDropdown
                    overflow={overflow}
                    overflowStartIndex={overflowStartIndex}
                    activeIndex={activeIndex}
                    onIndicatorChange={onIndicatorChange}
                    baseClassName={itemClass}
                    activeClassName={itemActiveClass}
                />
            )}
        </div>
    )
}

const IndicatorTabsVertical = ({
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
            className="MetadataSectionCollapsible__v-tabs"
            role="tablist"
            aria-orientation="vertical"
            aria-label="Indicator"
        >
            <IndicatorAboutLabel
                indicatorCount={indicators.length}
                className="MetadataSectionCollapsible__v-tabs-label"
            />
            {visible.map((ind, i) => (
                <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === activeIndex}
                    className={cx("MetadataSectionCollapsible__v-tab", {
                        "MetadataSectionCollapsible__v-tab--active":
                            i === activeIndex,
                    })}
                    onClick={() => onIndicatorChange(i)}
                    data-track-note="metadata_box_indicator_switch"
                >
                    {labelForIndicator(ind.datapageData)}
                </button>
            ))}
            {overflow.length > 0 && (
                <IndicatorMoreDropdown
                    overflow={overflow}
                    overflowStartIndex={overflowStartIndex}
                    activeIndex={activeIndex}
                    onIndicatorChange={onIndicatorChange}
                    baseClassName="MetadataSectionCollapsible__v-tab"
                    activeClassName="MetadataSectionCollapsible__v-tab--active"
                />
            )}
        </aside>
    )
}

// "What you should know" key takeaways, rendered inside <summary> so the
// preview is visible in both collapsed and expanded states (clipped + faded
// when collapsed via CSS). A single bullet renders as a paragraph; multiple
// bullets render as a <ul>.
const DescriptionKey = ({ descriptionKey }: { descriptionKey: string[] }) => {
    if (descriptionKey.length === 0) return null
    const body =
        descriptionKey.length === 1 ? (
            <SimpleMarkdownText text={descriptionKey[0].trim()} />
        ) : (
            <ul>
                {descriptionKey.map((text, i) => (
                    <li key={i}>
                        <SimpleMarkdownText
                            text={text.trim()}
                            useParagraphs={false}
                        />
                    </li>
                ))}
            </ul>
        )
    return (
        <section className="MetadataSectionCollapsible__description-key">
            <div className="key-info__key-description">{body}</div>
        </section>
    )
}

const ShortDescription = ({
    datapageData,
}: {
    datapageData: DataPageDataV2
}) => {
    if (!datapageData.descriptionShort) return null
    return (
        <div className="MetadataSectionCollapsible__short-description">
            <span className="MetadataSectionCollapsible__short-description-label">
                Short description
            </span>
            <span className="MetadataSectionCollapsible__short-description-text">
                <SimpleMarkdownText
                    text={datapageData.descriptionShort}
                    useParagraphs={false}
                />
            </span>
        </div>
    )
}

// Source attribution line shown right under the short description. Matches
// the grapher's "Data source:" footnote text so the user sees the same
// attribution in both places. Hyperlinked to the data-sources anchor so
// the user can jump straight to the source detail.
const buildSourceLineText = (attributions: readonly string[]): string => {
    const unique = _.uniq(_.compact(attributions))
    if (unique.length === 0) return ""
    if (unique.length > 3) return `${unique[0]} and other sources`
    return unique.join("; ")
}

const SourceLine = ({ datapageData }: { datapageData: DataPageDataV2 }) => {
    const text = buildSourceLineText(datapageData.attributions ?? [])
    if (!text) return null
    return (
        <div className="MetadataSectionCollapsible__source-line">
            <span className="MetadataSectionCollapsible__source-line-label">
                Data source
            </span>
            <span className="MetadataSectionCollapsible__source-line-text">
                {text}
            </span>
        </div>
    )
}

const ProcessingNotesCallout = ({
    descriptionProcessing,
}: {
    descriptionProcessing: string
}) => (
    <section className="MetadataSectionCollapsible__processing-notes">
        <h3 className="MetadataSectionCollapsible__section-heading MetadataSectionCollapsible__section-heading--minor">
            How we processed this indicator
        </h3>
        <div className="MetadataSectionCollapsible__processing-notes-body">
            <HtmlOrSimpleMarkdownText text={descriptionProcessing.trim()} />
        </div>
    </section>
)

const FaqsSection = ({
    faqEntries,
    anchorId,
}: {
    faqEntries: FaqEntryData
    // Optional: only the primary indicator's pane sets the anchor id (one
    // per box, since ids must be unique in the document).
    anchorId?: string
}) => {
    const { groups, preamble } = groupFaqsByHeading(faqEntries.faqs)
    if (!groups.length && !preamble.length) return null
    return (
        <section className="MetadataSectionCollapsible__faqs">
            <h3
                className="MetadataSectionCollapsible__section-heading MetadataSectionCollapsible__section-heading--minor"
                id={anchorId}
            >
                Frequently Asked Questions
            </h3>
            {preamble.length > 0 && (
                <div className="MetadataSectionCollapsible__faqs-preamble">
                    <ArticleBlocks blocks={preamble} containerType="datapage" />
                </div>
            )}
            <div className="MetadataSectionCollapsible__faqs-items">
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

const DataSourcesList = ({
    sources,
    anchorId,
    descriptionFromProducer,
}: {
    sources: DisplaySource[]
    // Optional: only the primary indicator's pane sets the anchor id.
    anchorId?: string
    // Indicator-level producer description, folded into the FIRST source's
    // detail panel rather than rendered as its own subsection of the box.
    descriptionFromProducer?: string
}) => {
    if (sources.length === 0) return null
    const heading = sources.length === 1 ? "Data source" : "Data sources"
    return (
        <section
            className="MetadataSectionCollapsible__sources-section"
            id={anchorId}
        >
            <h3 className="MetadataSectionCollapsible__section-heading">
                {heading}
            </h3>
            <div className="MetadataSectionCollapsible__sources-list">
                {sources.map((source, i) => (
                    <ExpandableToggle
                        key={`${source.label}-${i}`}
                        label={source.label}
                        content={
                            <MetadataSingleSource
                                source={source}
                                descriptionFromProducer={
                                    i === 0
                                        ? descriptionFromProducer
                                        : undefined
                                }
                            />
                        }
                        isStacked={i < sources.length - 1}
                    />
                ))}
            </div>
        </section>
    )
}

// "How to cite" subsection inside the metadata box. We deliberately fall
// back to the existing "Reuse this work" structure — license blurb up top,
// then linear citation subsections — instead of an expandable Q&A
// treatment, since this communicates the citation rules more directly.
const CitationGuidance = ({
    anchorId,
    citationShort,
    citationLong,
    citationDatapage,
}: {
    // Optional: only the primary indicator's pane sets the anchor id.
    anchorId?: string
    citationShort: string
    citationLong: string
    citationDatapage: string
}) => {
    const hasAnyCitation = !!(citationShort || citationLong || citationDatapage)
    return (
        <section
            className="MetadataSectionCollapsible__citation-guidance"
            id={anchorId}
        >
            <h3 className="MetadataSectionCollapsible__section-heading">
                How to cite
            </h3>
            <ul className="MetadataSectionCollapsible__license-blurb">
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
            {hasAnyCitation && (
                <div className="MetadataSectionCollapsible__citation-toggles">
                    {citationDatapage && (
                        <ExpandableToggle
                            label="How to cite this page"
                            content={
                                <div className="citations-section">
                                    <p className="citation__paragraph">
                                        To cite this page overall, including any
                                        descriptions, FAQs or explanations of
                                        the data authored by Our World in Data,
                                        please use the following citation:
                                    </p>
                                    <CodeSnippet
                                        code={citationDatapage}
                                        theme="light"
                                        useMarkdown={true}
                                    />
                                </div>
                            }
                            isStacked={!!(citationShort || citationLong)}
                        />
                    )}
                    {(citationShort || citationLong) && (
                        <ExpandableToggle
                            label="How to cite this data"
                            content={
                                <DataCitation
                                    citationLong={citationLong}
                                    citationShort={citationShort}
                                />
                            }
                        />
                    )}
                </div>
            )}
        </section>
    )
}

export default function MetadataSectionCollapsible({
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
    const isMulti = indicators.length > 1
    const switcherVariant = useSwitcherVariant()
    // h-tabs and h-pills share the same out-of-box "About this data" +
    // switcher header layout, with the selected indicator's title shown as
    // the first line inside the box (same treatment as single-indicator).
    const isHorizontalSwitcher =
        isMulti &&
        (switcherVariant === "h-tabs" || switcherVariant === "h-pills")

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

    // Compute everything derivable per-indicator ONCE for each indicator in
    // the chart, so the same pre-computed values can be re-used at each
    // place per-indicator content gets rendered (title, tldr, bullets,
    // FAQs, sources, citation).
    const currentYear = dayjs().year()
    const maybeAddPeriod = (s: string) =>
        s.endsWith("?") || s.endsWith(".") ? s : `${s}.`
    const archivalString = getPhraseForArchivalDate(
        archiveContext?.archivalDate
    )
    const indicatorPaneData = indicators.map((ind) => {
        const dp = ind.datapageData
        const producers = _.uniq(dp.origins.map((o) => `${o.producer}`))
        // Dedupe by label: multi-Y charts often share origins across
        // indicators (e.g. children-per-woman-un has one UN WPP origin per
        // Y variable), which would otherwise render the same source 10+
        // times in the Data sources list.
        const sourcesForDisplay = _.uniqBy(
            prepareSourcesForDisplay({
                origins: dp.origins,
                source: dp.source,
            }),
            "label"
        )
        const citationUrl = archiveContext?.archiveUrl ?? canonicalUrl
        const citationShort = getCitationShort(
            dp.origins,
            dp.attributions,
            dp.owidProcessingLevel
        )
        const citationLong = getCitationLong(
            dp.title,
            dp.origins,
            dp.source,
            dp.attributions,
            dp.attributionShort,
            dp.titleVariant,
            dp.owidProcessingLevel,
            citationUrl,
            archiveContext?.archivalDate
        )
        const adaptedFrom =
            producers.length > 0 ? producers.join(", ") : dp.source?.name
        const primaryTopicCitation = maybeAddPeriod(
            dp.primaryTopic?.citation ?? ""
        )
        const citationDatapage = excludeUndefined([
            dp.primaryTopic
                ? `“Data Page: ${dp.title.title}”, part of the following publication: ${primaryTopicCitation}`
                : `“Data Page: ${dp.title.title}”. Our World in Data (${currentYear}).`,
            adaptedFrom ? `Data adapted from ${adaptedFrom}.` : undefined,
            `Retrieved from ${citationUrl} [online resource]${
                archivalString ? ` ${archivalString}` : ""
            }`,
        ]).join(" ")
        return {
            ind,
            sourcesForDisplay,
            citationShort,
            citationLong,
            citationDatapage,
        }
    })

    // The indicator title (+ optional variant) wrapped in a baseline-aligned
    // inline-flex span so the variant sits on the same baseline as the title
    // text. Shared between the in-box title line and (for v-tabs) the
    // summary-key-data area.
    const renderIndicatorTitleLine = (dp: DataPageDataV2 = datapageData) => {
        const title = dp.title.title
        const variant = dp.titleVariant?.trim()
        if (!title) return null
        return (
            <span className="MetadataSectionCollapsible__indicator-title-line">
                <span className="MetadataSectionCollapsible__indicator-title">
                    {title}
                </span>
                {variant && (
                    <span className="MetadataSectionCollapsible__indicator-title-variant">
                        {variant}
                    </span>
                )}
            </span>
        )
    }

    // Render the title row inside the box's header strip (__above-switcher).
    // - Single indicator + h-tabs/h-pills (multi): renders ONE pane per
    //   indicator; the active pane is visible, others sit in the DOM
    //   hidden via CSS so AI agents reading raw HTML can still see each
    //   indicator's metadata.
    // - Dropdown variant: a single dropdown pill (no panes — the
    //   trigger's text already updates with the active indicator, and the
    //   other indicators are reachable through the popover).
    // - V-tabs: nothing here (the aside renders the tab list, and the
    //   per-indicator title row is rendered inside __summary-key-data
    //   below since the v-tabs variant skips the inline header).
    const renderHeaderSwitcher = () => {
        if (!isMulti || isHorizontalSwitcher) {
            return indicators.map((ind, i) => (
                <IndicatorPane key={i} index={i} active={i === safeIndex}>
                    {renderIndicatorTitleLine(ind.datapageData)}
                </IndicatorPane>
            ))
        }
        if (switcherVariant === "dropdown") {
            return (
                <IndicatorDropdown
                    activeDatapageData={datapageData}
                    indicators={indicators}
                    activeIndex={safeIndex}
                    onIndicatorChange={setActiveIndex}
                />
            )
        }
        return null
    }

    // The v-tabs aside renders the switcher beside the box, so no need for a
    // header strip above the row. For dropdown / h-tabs we pull the TLDR
    // bits (short description + factoids) up into the header so users can
    // tell at a glance what the box hides.
    const showInlineHeader = !(isMulti && switcherVariant === "v-tabs")
    const renderTldr = (dp: DataPageDataV2 = datapageData) => (
        <>
            <ShortDescription datapageData={dp} />
            <SourceLine datapageData={dp} />
            <div className="MetadataSectionCollapsible__factoids">
                <SummaryStats datapageData={dp} />
            </div>
        </>
    )
    // Loop helper: render one IndicatorPane per indicator and let `body`
    // pull the right per-indicator data + derived values out of each pane.
    const renderIndicatorPanes = (
        body: (
            pane: (typeof indicatorPaneData)[number],
            index: number
        ) => ReactNode
    ) =>
        indicatorPaneData.map((pane, i) => (
            <IndicatorPane key={i} index={i} active={i === safeIndex}>
                {body(pane, i)}
            </IndicatorPane>
        ))
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
    // body doesn't accidentally close the section — collapsing happens
    // only via the inline "Show less" affordance in the header row above.
    const onSummaryClick = (e: React.MouseEvent<HTMLElement>) => {
        // Keyboard-triggered clicks have detail === 0; let those toggle
        // normally so keyboard UX matches the native <details> behaviour.
        if (e.detail === 0) return
        if (!detailsRef.current?.open) return
        e.preventDefault()
    }
    // Click anywhere on the header row (__above) while the box is open to
    // collapse it. Stop propagation so the wrap-level onClick (which would
    // see `open === false` post-collapse and re-open the box) doesn't fire.
    // Skip clicks on interactive children (e.g. the multi-indicator switcher
    // dropdown) — they handle their own behavior.
    const onAboveClick = (e: React.MouseEvent<HTMLElement>) => {
        if (!detailsRef.current?.open) return
        e.stopPropagation()
        const target = e.target as HTMLElement
        if (target.closest("button, a, input, select, textarea, label")) return
        collapse()
    }
    return (
        <div
            className={cx(
                "MetadataSectionCollapsible-wrap",
                `MetadataSectionCollapsible-wrap--${switcherVariant}`,
                {
                    "MetadataSectionCollapsible-wrap--no-above":
                        !showInlineHeader,
                },
                className
            )}
            onClick={onWrapClick}
        >
            {/*
             * Horizontal-switcher variants render "About this data" + the
             * tab/pill row OUTSIDE the box, so the row reads as a header
             * for the whole box. The selected indicator's title is then
             * shown as the first line INSIDE the box (handled inside
             * renderHeaderSwitcher).
             */}
            {isHorizontalSwitcher && (
                <div className="MetadataSectionCollapsible__multi-header">
                    <IndicatorAboutLabel indicatorCount={indicators.length} />
                    <IndicatorTabsHorizontal
                        indicators={indicators}
                        activeIndex={safeIndex}
                        onIndicatorChange={setActiveIndex}
                        variant={
                            switcherVariant === "h-pills" ? "pills" : "tabs"
                        }
                    />
                </div>
            )}
            {showInlineHeader && (
                <header
                    className="MetadataSectionCollapsible__above"
                    onClick={onAboveClick}
                >
                    <div className="MetadataSectionCollapsible__above-switcher">
                        {renderHeaderSwitcher()}
                        {/* Inline "Show less" affordance — pushed to the right
                            via flexbox in SCSS, visible only when the box is
                            open (controlled via :has() in SCSS). Click target
                            is the whole __above row above, not the span. */}
                        <span
                            className="MetadataSectionCollapsible__inline-show-less"
                            aria-hidden="true"
                        >
                            Show less
                            <FontAwesomeIcon
                                className="MetadataSectionCollapsible__icon"
                                icon={faChevronUp}
                            />
                        </span>
                    </div>
                    {renderIndicatorPanes((pane) =>
                        renderTldr(pane.ind.datapageData)
                    )}
                </header>
            )}
            <div className="MetadataSectionCollapsible__main">
                {isMulti && switcherVariant === "v-tabs" && (
                    <IndicatorTabsVertical
                        indicators={indicators}
                        activeIndex={safeIndex}
                        onIndicatorChange={setActiveIndex}
                    />
                )}
                <details
                    ref={detailsRef}
                    className="MetadataSectionCollapsible"
                >
                    <summary
                        className="MetadataSectionCollapsible__summary"
                        onClick={onSummaryClick}
                    >
                        <div className="MetadataSectionCollapsible__summary-key-data">
                            {!showInlineHeader &&
                                renderIndicatorPanes((pane) =>
                                    renderIndicatorTitleLine(
                                        pane.ind.datapageData
                                    )
                                )}
                            {!showInlineHeader &&
                                renderIndicatorPanes((pane) =>
                                    renderTldr(pane.ind.datapageData)
                                )}
                            {renderIndicatorPanes((pane) => (
                                <DescriptionKey
                                    descriptionKey={
                                        pane.ind.datapageData.descriptionKey ??
                                        []
                                    }
                                />
                            ))}
                            <span className="MetadataSectionCollapsible__toggle MetadataSectionCollapsible__toggle--show-more">
                                Show more
                                <FontAwesomeIcon
                                    className="MetadataSectionCollapsible__icon"
                                    icon={faChevronDown}
                                />
                            </span>
                        </div>
                    </summary>

                    <div
                        className="MetadataSectionCollapsible__content"
                        id={DATAPAGE_ABOUT_THIS_DATA_SECTION_ID}
                    >
                        {/*
                         * One pane per indicator for each section. Anchor
                         * ids only live on the PRIMARY indicator's pane
                         * (index 0) — they're singletons in the DOM, the
                         * primary's pane is the default-visible one, and
                         * giving multiple panes the same id would be
                         * invalid HTML.
                         */}
                        {renderIndicatorPanes((pane, i) =>
                            pane.ind.faqEntries ? (
                                <FaqsSection
                                    faqEntries={pane.ind.faqEntries}
                                    anchorId={i === 0 ? FAQS_ID : undefined}
                                />
                            ) : null
                        )}

                        {renderIndicatorPanes((pane) =>
                            pane.ind.datapageData.descriptionProcessing ? (
                                <ProcessingNotesCallout
                                    descriptionProcessing={
                                        pane.ind.datapageData
                                            .descriptionProcessing
                                    }
                                />
                            ) : null
                        )}

                        {renderIndicatorPanes((pane, i) => (
                            <DataSourcesList
                                sources={pane.sourcesForDisplay}
                                anchorId={
                                    i === 0
                                        ? DATAPAGE_SOURCES_AND_PROCESSING_SECTION_ID
                                        : undefined
                                }
                                descriptionFromProducer={
                                    pane.ind.datapageData
                                        .descriptionFromProducer
                                }
                            />
                        ))}

                        {renderIndicatorPanes((pane, i) => (
                            <CitationGuidance
                                anchorId={
                                    i === 0 ? CITATION_GUIDANCE_ID : undefined
                                }
                                citationShort={pane.citationShort}
                                citationLong={pane.citationLong}
                                citationDatapage={pane.citationDatapage}
                            />
                        ))}
                    </div>
                    <button
                        type="button"
                        className="MetadataSectionCollapsible__toggle MetadataSectionCollapsible__toggle--show-less"
                        onClick={collapse}
                    >
                        <span className="MetadataSectionCollapsible__toggle-label">
                            Show less
                            <FontAwesomeIcon
                                className="MetadataSectionCollapsible__icon MetadataSectionCollapsible__icon--up"
                                icon={faChevronDown}
                            />
                        </span>
                    </button>
                </details>
            </div>
        </div>
    )
}
