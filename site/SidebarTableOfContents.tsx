import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowUp, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons"
import { Toc, TocChartEntry, TocSidebarSection } from "@ourworldindata/utils"
import {
    ChartConfigType,
    LinkedChart,
    SearchResultType,
} from "@ourworldindata/types"
import { useLinkedChart, useLinkedNarrativeChart } from "./gdocs/utils.js"
import { buildSearchHrefForCard } from "./search/searchState.js"

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

    // No H1 sections → no sidebar. This is intentional: an LTP with no H1s is
    // an editorial fix, not a runtime fallback.
    if (sections.length === 0) return null

    return (
        <div className="sidebar-toc">
            <nav className="sidebar-toc__sidebar" aria-label="Table of contents">
                <TocBody sections={sections} tagName={tagName} />
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
        </div>
    )
}

const TocBody = ({
    sections,
    tagName,
    activeId,
    onLinkClick,
}: {
    sections: TocSidebarSection[]
    tagName?: string
} & TocNavProps) => {
    return (
        <>
            <a
                className="sidebar-toc__back-to-top"
                href="#"
                data-track-note="toc_back_to_top"
            >
                <FontAwesomeIcon icon={faArrowUp} />
                Back to top
            </a>
            {sections.map((section, i) => (
                // Index-qualified: two H1s can slug identically (no dedup).
                <SectionGroup
                    key={`${section.heading.slug}-${i}`}
                    section={section}
                />
            ))}
            {tagName ? <SeeAllChartsCta tagName={tagName} /> : null}
        </>
    )
}

const SectionGroup = ({
    section,
    activeId,
    onLinkClick,
}: { section: TocSidebarSection } & TocNavProps) => {
    const { heading, charts } = section
    return (
        <div className="sidebar-toc__section">
            <a
                className="sidebar-toc__h1"
                href={`#${heading.slug}`}
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
                                onLinkClick={onLinkClick}
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

    return (
        <Bullet
            anchorId={entry.anchorId}
            label={label}
            visibility={entry.visibility}
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
    return <Bullet anchorId={entry.anchorId} label={info.title} />
}

const Bullet = ({
    anchorId,
    label,
    visibility,
}: {
    anchorId: string
    label: string
    visibility?: Extract<TocChartEntry, { kind: "chart" }>["visibility"]
}) => {
    return (
        <li
            className={cx("sidebar-toc__bullet", {
                "hide-sm-only": visibility === "desktop",
                "show-sm-only": visibility === "mobile",
            })}
        >
            <a href={`#${anchorId}`} data-track-note="toc_link">
                {label}
            </a>
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
