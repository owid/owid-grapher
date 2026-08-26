import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCaretDown, faFilter } from "@fortawesome/free-solid-svg-icons"
import { TagGraphRoot } from "@ourworldindata/types"
import { LatestPageHeader } from "./LatestPageHeader.js"
import { LatestSearchSkeleton } from "./LatestSearchSkeleton.js"
import {
    LATEST_FACETS_CONTAINER_CLASSES,
    LATEST_FILTERS_DIVIDER_CLASSES,
} from "./latestUtils.js"

/**
 * Static stand-in for the /latest UI, baked into the page HTML so the layout
 * doesn't jump while the client-side app loads. React replaces it wholesale
 * when it mounts into #latest-page-root (createRoot, not hydration), so it
 * only needs to look like LatestSearch's initial loading render — the facets
 * are inert copies, not the react-aria/scroll-menu components.
 */
export const LatestPageSkeleton = ({
    topicTagGraph,
}: {
    topicTagGraph: TagGraphRoot
}) => {
    const areas = topicTagGraph.children.map((child) => child.name)

    return (
        <>
            <LatestPageHeader />
            <div className={LATEST_FACETS_CONTAINER_CLASSES}>
                <div className="latest-topic-facets" aria-hidden="true">
                    <div className="latest-topic-facets__filters">
                        <div className="latest-topic-facets__topic-pills">
                            <div className="latest-topic-facets-skeleton__pill-row">
                                <div
                                    className="latest-topic-facets__topic-pill"
                                    data-selected="true"
                                >
                                    All
                                </div>
                                {areas.map((area) => (
                                    <div
                                        key={area}
                                        className="latest-topic-facets__topic-pill"
                                    >
                                        {area}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="latest-topic-facets__content-type-dropdown">
                            <div className="latest-topic-facets__content-type-trigger">
                                <FontAwesomeIcon
                                    icon={faFilter}
                                    className="latest-topic-facets__content-type-trigger-icon"
                                />
                                <span className="latest-topic-facets__content-type-trigger-label">
                                    Filter by type
                                </span>
                                <FontAwesomeIcon
                                    icon={faCaretDown}
                                    className="latest-topic-facets__content-type-trigger-chevron"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <hr className={LATEST_FILTERS_DIVIDER_CLASSES} />
            <LatestSearchSkeleton />
        </>
    )
}
