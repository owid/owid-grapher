import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    ReactNode,
} from "react"
import { ModalOverlay, Modal, Dialog } from "react-aria-components"
import { useMediaQuery } from "usehooks-ts"
import cx from "classnames"
import Tippy from "@tippyjs/react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowUp,
    faMagnifyingGlass,
    faListUl,
    faXmark,
    faAnglesLeft,
} from "@fortawesome/free-solid-svg-icons"
import { Toc, TocChartEntry,
    TocSidebarSection,
    queryParamsToStr,
    Url,
} from "@ourworldindata/utils"
import {
    ChartConfigType,
    LinkedChart,
    SearchResultType,
} from "@ourworldindata/types"
import { useLinkedChart, useLinkedNarrativeChart } from "./gdocs/utils.js"
import { useDocumentContext } from "./gdocs/DocumentContext.js"
import { ChartPreview } from "./gdocs/components/ChartPreview.js"
import { buildSearchHrefForCard } from "./search/searchState.js"
import { useTocScrollSpy } from "./useTocScrollSpy.js"
import { useWideBlockInView } from "./useWideBlockInView.js"
import { SiteAnalytics } from "./SiteAnalytics.js"

const analytics = new SiteAnalytics()

// Mirrors $sidebar-toc-breakpoint in SidebarTableOfContents.scss: at/below this
// width the mobile pill + mobile drawer replace the desktop sidebar.
const SIDEBAR_TOC_BREAKPOINT = 1200

// Scroll-spy state threaded through the section/bullet tree.
interface TocNavProps {
    activeId: string
}

// Navigating via any TOC link (or Back to top) must dismiss the mobile drawer.
// Only the mobile drawer provides a value; in the desktop sidebar there's
// nothing to dismiss, so links there are plain anchors.
const TocNavigateContext = createContext<(() => void) | undefined>(undefined)

const chartBulletLabel = (linkedChart: LinkedChart): string => {
    const isDataExplorer =
        linkedChart.configType === ChartConfigType.MultiDim ||
        linkedChart.configType === ChartConfigType.Explorer
    return isDataExplorer
        ? `Data Explorer: ${linkedChart.title}`
        : linkedChart.title
}

export const SidebarTableOfContents = ({
    toc,
    tagName,
}: {
    /** Sidebar-shaped TOC generated for the desktop sidebar. */
    toc: Extract<Toc, { kind: "sidebar" }>
    /** Topic tag used to build the bottom "See all charts" CTA. The desktop
     *  sidebar still renders without it — the CTA is simply omitted. */
    tagName?: string
}) => {
    const { sections } = toc

    // Document-ordered ids the scroll-spy observes: each H1 slug followed by
    // its chart anchor ids. Charts whose embed didn't render are simply absent
    // from the DOM and skipped by the spy.
    const spyIds = useMemo(
        () =>
            sections.flatMap((section) => [
                section.heading.slug,
                ...section.charts.map((chart) => chart.anchorId),
            ]),
        [sections]
    )
    const activeId = useTocScrollSpy(spyIds)
    const isWideBlockInView = useWideBlockInView()

    // Desktop-only; the sidebar is expanded by default.
    const [prefersExpanded, setPrefersExpanded] = useState(true)

    // Close the mobile drawer if the viewport grows to desktop (resize /
    // rotate / zoom) so it isn't stranded over the sidebar.
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
    const isDesktop = useMediaQuery(
        `(min-width: ${SIDEBAR_TOC_BREAKPOINT + 1}px)`
    )
    useEffect(() => {
        if (isDesktop) setIsMobileDrawerOpen(false)
    }, [isDesktop])

    // No H1 sections → no sidebar. This is intentional: an LTP with no H1s is
    // an editorial fix, not a runtime fallback.
    if (sections.length === 0) return null

    return (
        <TocActiveContext.Provider value={{ activeId, onLinkClick }}>
            <div className="sidebar-toc">
                <nav
                    className={cx("sidebar-toc__sidebar", {
                        "sidebar-toc__sidebar--wide-in-view": wideBlockInView,
                        "sidebar-toc__sidebar--collapsed": isCollapsed,
                    })}
                    aria-label="Table of contents"
                >
                    {/* Content stays mounted in both states so collapsing can
                        slide+fade it (the frame width never changes, so the
                        content never rewraps). When collapsed it's translated
                        off-screen and hidden by the --collapsed rule; the toggle
                        below swaps to the expand affordance. Scroll lives on
                        this inner wrapper so the sidebar frame doesn't clip the
                        toggle tab. */}
                    <div className="sidebar-toc__sidebar-content">
                        <BackToTop />
                        <TocSections sections={sections} tagName={tagName}
                            activeId={activeId}
                        />
                    </div>
                    {/* Toggle is a child of the sidebar (so it slides with it) but
                        protrudes past the divider via a negative offset; the
                        frame has no overflow so it isn't clipped. Collapse and
                        expand swap in place, keeping the affordance on the
                        divider in both states. */}
                    {isCollapsed ? (
                        <button
                            className="sidebar-toc__expand"
                            onClick={() => setIsCollapsed(false)}
                            aria-label="Open table of contents"
                            data-track-note="toc_expand"
                        >
                            <FontAwesomeIcon icon={faListUl} />
                        </button>
                    ) : (
                        <button
                            className="sidebar-toc__collapse-toggle"
                            onClick={() => setIsCollapsed(true)}
                            aria-label="Collapse table of contents"
                            data-track-note="toc_collapse"
                        >
                            <FontAwesomeIcon icon={faAnglesLeft} />
                        </button>
                    )}
                </nav>

                <button
                    className="sidebar-toc__toggle"
                    onClick={() => {
                        if (isSidebarExpanded) {
                            setPrefersExpanded(false)
                            setIsForcedExpanded(false)
                        } else {
                            setPrefersExpanded(true)
                            // Expanding over a wide block sets the forced expanded state
                            if (isWideBlockInView) setIsForcedExpanded(true)
                        }
                    }}
                    aria-label={
                        isSidebarExpanded
                            ? "Collapse table of contents"
                            : "Open table of contents"
                    }
                    aria-expanded={isSidebarExpanded}
                    aria-controls={sidebarContentId}
                    data-track-note={
                        isSidebarExpanded ? "toc_collapse" : "toc_expand"
                    }
                >
                    <FontAwesomeIcon
                        icon={isSidebarExpanded ? faAnglesLeft : faListUl}
                    />
                </button>
                <div
                    className="sidebar-toc__sidebar-content"
                    id={sidebarContentId}
                    ref={sidebarContentRef}
                >
                    <BackToTop />
                    <TocSections
                        sections={sections}
                        tagName={tagName}
                        activeId={activeId}
                    />
                </div>
            </nav>

            <button
                className="sidebar-toc__mobile-pill"
                onClick={() => setIsMobileDrawerOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={isMobileDrawerOpen}
                data-track-note="toc_expand"
            >
                <FontAwesomeIcon icon={faListUl} />
                Contents
            </button>

            {/* react-aria Modal: portals out of the article grid's stacking
                contexts, traps + restores focus, locks body scroll, and closes
                on Escape / outside click (isDismissable). Mounted only while
                open, keeping Tippy/preview machinery dormant. */}
            <ModalOverlay
                className="sidebar-toc__mobile-drawer-overlay"
                isOpen={isMobileDrawerOpen}
                onOpenChange={setIsMobileDrawerOpen}
                isDismissable
            >
                <Modal className="sidebar-toc__mobile-drawer-modal">
                    <Dialog
                        className="sidebar-toc__mobile-drawer"
                        aria-label="Table of contents"
                    >
                        {({ close }) => (
                            <TocNavigateContext.Provider value={close}>
                                <div className="sidebar-toc__mobile-drawer-header">
                                    <BackToTop />
                                    <button
                                        className="sidebar-toc__mobile-drawer-close"
                                        onClick={close}
                                        aria-label="Close table of contents"
                                    >
                                        <FontAwesomeIcon icon={faXmark} />
                                    </button>
                                </div>
                                <TocSections
                                    sections={sections}
                                    tagName={tagName}
                                    activeId={activeId}
                                />
                            </TocNavigateContext.Provider>
                        )}
                    </Dialog>
                </Modal>
            </ModalOverlay>
        </div>
    )
}

const BackToTop = () => {
    const onNavigate = useContext(TocNavigateContext)
    return (
        <a
            className="sidebar-toc__back-to-top"
            href="#"
            // Own the scroll instead of relying on the bare "#" default, which
            // appends "#" to the URL and pushes a history entry.
            onClick={(e) => {
                e.preventDefault()
                const reduceMotion = window.matchMedia(
                    "(prefers-reduced-motion: reduce)"
                ).matches
                window.scrollTo({
                    top: 0,
                    behavior: reduceMotion ? "auto" : "smooth",
                })
                onNavigate?.()
            }}
            data-track-note="toc_back_to_top"
        >
            Back to top
            <FontAwesomeIcon icon={faArrowUp} />
        </a>
    )
}

const TocSections = ({
    sections,
    tagName,
    activeId,
}: {
    sections: TocSidebarSection[]
    tagName?: string
} & TocNavProps) => {
    return (
        <>
            {sections.map((section, i) => (
                // Index-qualified: two H1s can slug identically (no dedup).
                <SectionGroup
                    key={`${section.heading.slug}-${i}`}
                    section={section}
                    activeId={activeId}
                />
            ))}
            {tagName ? <SeeAllChartsCta tagName={tagName} /> : null}
        </>
    )
}

const SectionGroup = ({
    section,
    activeId,
}: { section: TocSidebarSection } & TocNavProps) => {
    const onNavigate = useContext(TocNavigateContext)
    const { heading, charts } = section
    return (
        <div
            className={cx("sidebar-toc__section", {
                "sidebar-toc__section--active": activeId === heading.slug,
            })}
        >
            <a
                className="sidebar-toc__h1"
                href={`#${heading.slug}`}
                onClick={onNavigate}
                data-track-note="toc_link"
                aria-current={
                    activeId === heading.slug ? "location" : undefined
                }
            >
                {heading.text}
            </a>
            {charts.length > 0 ? (
                <>
                    <p className="sidebar-toc__charts-eyebrow">Charts</p>
                    <ul
                        className={cx("sidebar-toc__bullets", {
                            "sidebar-toc__bullets--single": charts.length === 1,
                        })}
                    >
                        {charts.map((entry) => (
                            <ChartBullet
                                key={entry.anchorId}
                                entry={entry}
                                activeId={activeId}
                            />
                        ))}
                    </ul>
                </>
            ) : null}
        </div>
    )
}

const ChartBullet = ({
    entry,
    ...navProps
}: { entry: TocChartEntry } & TocNavProps) => {
    if (entry.kind === "narrative-chart")
        return <NarrativeChartBullet entry={entry} {...navProps} />
    return <GrapherChartBullet entry={entry} {...navProps} />
}

const GrapherChartBullet = ({
    entry,
    ...navProps
}: {
    entry: Extract<TocChartEntry, { kind: "chart" }>
} & TocNavProps) => {
    const { linkedChart } = useLinkedChart(entry.url)
    // The chart isn't rendering on the page either, so there's no anchor to
    // link to — skip the bullet entirely rather than show a dead link.
    if (!linkedChart) return null

    const label = chartBulletLabel(linkedChart)

    const url = Url.fromURL(linkedChart.resolvedUrl)
    // Best-effort preview: a multi-dim resolves to its /grapher route, so the
    // thumbnail shows the default dimension view, not the doc's selection.
    const preview = (
        <ChartPreview
            chartType={url.isExplorer ? "explorer" : "chart"}
            chartSlug={url.slug || ""}
            queryString={url.queryStr}
        />
    )

    return (
        <Bullet
            anchorId={entry.anchorId}
            label={label}
            preview={preview}
            previewUrl={linkedChart.resolvedUrl}
            visibility={entry.visibility}
            {...navProps}
        />
    )
}

const NarrativeChartBullet = ({
    entry,
    ...navProps
}: {
    entry: Extract<TocChartEntry, { kind: "narrative-chart" }>
} & TocNavProps) => {
    const info = useLinkedNarrativeChart(entry.name)
    if (!info) return null

    // Best-effort preview: the dynamic thumbnail renders the parent chart and
    // may not reflect narrative-specific config tweaks.
    const queryString = queryParamsToStr(info.queryParamsForParentChart)
    const preview = (
        <ChartPreview
            chartSlug={info.parentChartSlug}
            queryString={queryString}
        />
    )

    return (
        <Bullet
            anchorId={entry.anchorId}
            label={info.title}
            preview={preview}
            previewUrl={`${info.parentChartSlug}${queryString}`}
            {...navProps}
        />
    )
}

const Bullet = ({
    anchorId,
    label,
    preview,
    previewUrl,
    visibility,
    activeId,
}: {
    anchorId: string
    label: string
    preview: ReactNode
    previewUrl: string
    visibility?: Extract<TocChartEntry, { kind: "chart" }>["visibility"]
} & TocNavProps) => {
    const onNavigate = useContext(TocNavigateContext)
    const { archiveContext } = useDocumentContext()
    const isOnArchivalPage = archiveContext?.type === "archive-page"

    const link = (
        <a
            href={`#${anchorId}`}
            onClick={onNavigate}
            data-track-note="toc_link"
            aria-current={activeId === anchorId ? "location" : undefined}
        >
            {label}
        </a>
    )

    return (
        <li
            className={cx("sidebar-toc__bullet", {
                "sidebar-toc__bullet--active": activeId === anchorId,
                "hide-sm-only": visibility === "desktop",
                "show-sm-only": visibility === "mobile",
            })}
        >
            {isOnArchivalPage ? (
                link
            ) : (
                <Tippy
                    content={preview}
                    onShow={() =>
                        analytics.logChartPreviewMouseover(previewUrl)
                    }
                    delay={[300, 0]}
                    placement="top"
                    maxWidth={512}
                    theme="light"
                    arrow={false}
                    touch={false}
                >
                    {link}
                </Tippy>
            )}
        </li>
    )
}

const SeeAllChartsCta = ({ tagName }: { tagName: string }) => {
    return (
        <a
            className="sidebar-toc__cta"
            href={buildSearchHrefForCard(SearchResultType.DATA, tagName)}
            data-track-note="toc_see_all_charts"
        >
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            See all charts on this topic
        </a>
    )
}
