import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react"
import { ModalOverlay, Modal, Dialog } from "react-aria-components"
import { useMediaQuery } from "usehooks-ts"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowUp,
    faMagnifyingGlass,
    faListUl,
    faXmark,
    faAnglesLeft,
} from "@fortawesome/free-solid-svg-icons"
import { TocHeadingWithSupertitle } from "@ourworldindata/utils"
import { SearchResultType } from "@ourworldindata/types"
import { useDocumentContext } from "./gdocs/DocumentContext.js"
import { ScrollDirection, useScrollDirection } from "./hooks.js"
import { buildSearchHrefForCard } from "./search/searchState.js"
import { useKeepActiveTocRowInView } from "./useKeepActiveTocRowInView.js"
import { useTocScrollSpy } from "./useTocScrollSpy.js"
import { useWideBlockInView } from "./useWideBlockInView.js"

// Mirrors $sidebar-toc-sm in SidebarTableOfContents.scss: at/below this
// width the mobile pill + mobile drawer replace the desktop sidebar.
const SIDEBAR_TOC_SM = 1200

const SIDEBAR_TOC_CONTENT_ID = "sidebar-toc-content"

// Scroll-spy state threaded through the section/subheading tree.
interface TocNavProps {
    activeId: string
}

// Navigating via any TOC link (or Back to top) must dismiss the mobile drawer.
// Only the mobile drawer provides a value; in the desktop sidebar there's
// nothing to dismiss, so links there are plain anchors.
const TocNavigateContext = createContext<(() => void) | undefined>(undefined)

// A top-level (h1) heading together with the h2 subheadings nested beneath it.
interface SidebarSection {
    heading: TocHeadingWithSupertitle
    subheadings: TocHeadingWithSupertitle[]
}

// The TOC arrives flat and document-ordered, with `isSubheading` marking the
// h2s. Group it so each h1 carries its following h2s: every non-subheading
// opens a new section, every subheading attaches to the current one. A leading
// subheading with no preceding h1 (editorially unusual) becomes its own
// section so it isn't dropped.
const groupIntoSections = (
    headings: TocHeadingWithSupertitle[]
): SidebarSection[] => {
    const sections: SidebarSection[] = []
    for (const heading of headings) {
        const current = sections.at(-1)
        if (heading.isSubheading && current) {
            current.subheadings.push(heading)
        } else {
            sections.push({ heading, subheadings: [] })
        }
    }
    return sections
}

export const SidebarTableOfContents = ({
    headings,
    tagName,
}: {
    /** Flat, document-ordered TOC headings (h1 sections + h2 subheadings),
     *  generated for the desktop sidebar. */
    headings: TocHeadingWithSupertitle[]
    /** Topic tag used to build the bottom "See all charts" CTA. The desktop
     *  sidebar still renders without it — the CTA is simply omitted. */
    tagName?: string
}) => {
    const sections = useMemo(() => groupIntoSections(headings), [headings])

    // Document-ordered ids the scroll-spy observes: every heading slug, which
    // is rendered as the corresponding heading element's id.
    const spyIds = useMemo(() => headings.map((h) => h.slug), [headings])
    const activeId = useTocScrollSpy(spyIds)
    const sidebarContentRef = useKeepActiveTocRowInView(activeId)
    const isWideBlockInView = useWideBlockInView()

    // Desktop-only expansion state. The sidebar shows unless something
    // argues against it: the reader is scrolling down, a wide block is in
    // view, or the reader dismissed it via the toggle. It renders collapsed
    // at first (matching the baked HTML), then slides in once the client has
    // measured that no wide block overlaps.
    // isDismissedRef: the user collapsed the sidebar via the toggle, so
    // scroll-up no longer auto-expands it; only toggle-expand does (and
    // re-arms the auto-expand). A ref, not state: it only gates future
    // scroll events and never changes what's rendered.
    const scrollDirection = useScrollDirection()
    const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
    const isDismissedRef = useRef(false)

    // isWideBlockInView is a dependency so that the initial release (page
    // load, scrollDirection still null) slides the sidebar in, and scrolling
    // up past a wide block expands it as soon as the block releases it.
    useEffect(() => {
        if (scrollDirection === ScrollDirection.Down) {
            setIsSidebarExpanded(false)
        } else if (!isDismissedRef.current && !isWideBlockInView) {
            setIsSidebarExpanded(true)
        }
    }, [scrollDirection, isWideBlockInView])

    // Only the transition into view collapses, so toggle-expanding while a
    // wide block is in view sticks (the user overrode the auto-collapse)
    // until the next wide-block encounter or scroll-down.
    useEffect(() => {
        if (isWideBlockInView) setIsSidebarExpanded(false)
    }, [isWideBlockInView])

    // Close the mobile drawer if the viewport grows to desktop (resize /
    // rotate / zoom) so it isn't stranded over the sidebar.
    const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false)
    const isDesktop = useMediaQuery(`(min-width: ${SIDEBAR_TOC_SM + 1}px)`)
    useEffect(() => {
        if (isDesktop) setIsMobileDrawerOpen(false)
    }, [isDesktop])

    // No H1 sections → no sidebar. This is intentional: an LTP with no H1s is
    // an editorial fix, not a runtime fallback.
    if (sections.length === 0) return null

    return (
        <div className="sidebar-toc">
            <nav
                className={cx("sidebar-toc__sidebar", {
                    "sidebar-toc__sidebar--collapsed": !isSidebarExpanded,
                })}
                aria-label="Table of contents"
            >
                {/* The toggle precedes the content in the DOM (though absolute
                    positioning places it visually on the right edge) so that
                    expanding a collapsed sidebar via the keyboard leaves focus
                    on the toggle, and the next Tab flows forward into the
                    revealed links rather than out into the article. */}
                <button
                    className="sidebar-toc__toggle"
                    onClick={() => {
                        // Collapsing dismisses (disables the scroll-up
                        // auto-expand); expanding re-arms it.
                        isDismissedRef.current = isSidebarExpanded
                        setIsSidebarExpanded(!isSidebarExpanded)
                    }}
                    // Disclosure button: a stable noun-phrase name; aria-expanded
                    // carries the state. https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
                    aria-label="Table of contents"
                    aria-expanded={isSidebarExpanded}
                    aria-controls={SIDEBAR_TOC_CONTENT_ID}
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
                    id={SIDEBAR_TOC_CONTENT_ID}
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
        <button
            type="button"
            className="sidebar-toc__back-to-top"
            onClick={() => {
                window.scrollTo(0, 0)
                onNavigate?.()
            }}
            data-track-note="toc_back_to_top"
        >
            Back to top
            <FontAwesomeIcon icon={faArrowUp} />
        </button>
    )
}

const TocSections = ({
    sections,
    tagName,
    activeId,
}: {
    sections: SidebarSection[]
    tagName?: string
} & TocNavProps) => {
    return (
        <>
            {/* A nested list so assistive technologies announce "list, N items"
                and the heading→subheading hierarchy: each section is an <li>
                carrying its H1 link and (optionally) a sub-<ul> of H2s. */}
            <ol className="sidebar-toc__sections">
                {sections.map((section, i) => (
                    // Index-qualified: two H1s can slug identically (no dedup).
                    <SectionGroup
                        key={`${section.heading.slug}-${i}`}
                        section={section}
                        activeId={activeId}
                    />
                ))}
            </ol>
            {tagName ? <SeeAllChartsCta tagName={tagName} /> : null}
        </>
    )
}

const SectionGroup = ({
    section,
    activeId,
}: { section: SidebarSection } & TocNavProps) => {
    const onNavigate = useContext(TocNavigateContext)
    const { heading, subheadings } = section
    return (
        <li
            className={cx("sidebar-toc__section", {
                "sidebar-toc__section--active": activeId === heading.slug,
            })}
        >
            <a
                className="sidebar-toc__h1"
                href={`#${heading.slug}`}
                onClick={onNavigate}
                data-track-note="toc_link"
                data-toc-id={heading.slug}
                aria-current={
                    activeId === heading.slug ? "location" : undefined
                }
            >
                {heading.title}
            </a>
            {subheadings.length > 0 ? (
                <ul className="sidebar-toc__subheadings">
                    {subheadings.map((subheading) => (
                        <SubheadingRow
                            key={subheading.slug}
                            subheading={subheading}
                            activeId={activeId}
                        />
                    ))}
                </ul>
            ) : null}
        </li>
    )
}

const SubheadingRow = ({
    subheading,
    activeId,
}: { subheading: TocHeadingWithSupertitle } & TocNavProps) => {
    const onNavigate = useContext(TocNavigateContext)
    const { slug, title } = subheading

    return (
        <li
            className={cx("sidebar-toc__subheading", {
                "sidebar-toc__subheading--active": activeId === slug,
            })}
            data-toc-id={slug}
        >
            <a
                href={`#${slug}`}
                onClick={onNavigate}
                data-track-note="toc_link"
                aria-current={activeId === slug ? "location" : undefined}
            >
                {title}
            </a>
        </li>
    )
}

const SeeAllChartsCta = ({ tagName }: { tagName: string }) => {
    const { archiveContext } = useDocumentContext()
    // The CTA links to the live site's search, which doesn't exist on (and
    // wouldn't reflect) an archived snapshot — omit it there. Currently
    // defensive: only articles get archived and none use the sidebar TOC,
    // so this only kicks in if LTP/profile archiving ships.
    if (archiveContext?.type === "archive-page") return null

    return (
        <a
            className="sidebar-toc__cta"
            href={buildSearchHrefForCard(SearchResultType.DATA, tagName)}
            data-track-note="toc_see_all_charts"
        >
            <FontAwesomeIcon icon={faMagnifyingGlass} />
            {/* Full label by default; a container query swaps in the short one
                in panels too narrow to fit it. */}
            <span className="sidebar-toc__cta-label--full">
                See all charts on this topic
            </span>
            <span className="sidebar-toc__cta-label--short">
                See all charts
            </span>
        </a>
    )
}
