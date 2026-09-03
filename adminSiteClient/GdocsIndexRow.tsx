import * as React from "react"
import cx from "clsx"
import {
    faHouse,
    faLightbulb,
    faNewspaper,
    faPuzzlePiece,
    faThList,
    faBuildingNgo,
    faUserPen,
    faBullhorn,
    faFileLines,
    faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    DbChartTagJoin,
    OwidGdocType,
    OwidGdocIndexItem,
    MinimalTagWithMetadata,
    TagGraphRole,
} from "@ourworldindata/utils"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { EditableTags } from "./EditableTags.js"
import { GdocsEditLink } from "./GdocsEditLink.js"
import { checkCanTagGdocType } from "./gdocsTagging.js"
import { Link } from "./Link.js"

const iconGdocTypeMap = {
    [OwidGdocType.Fragment]: <FontAwesomeIcon icon={faPuzzlePiece} />,
    [OwidGdocType.Article]: <FontAwesomeIcon icon={faNewspaper} />,
    [OwidGdocType.TopicPage]: <FontAwesomeIcon icon={faLightbulb} />,
    [OwidGdocType.LinearTopicPage]: <FontAwesomeIcon icon={faLightbulb} />,
    [OwidGdocType.DataInsight]: <FontAwesomeIcon icon={faThList} />,
    [OwidGdocType.Homepage]: <FontAwesomeIcon icon={faHouse} />,
    [OwidGdocType.AboutPage]: <FontAwesomeIcon icon={faBuildingNgo} />,
    [OwidGdocType.Author]: <FontAwesomeIcon icon={faUserPen} />,
    [OwidGdocType.Announcement]: <FontAwesomeIcon icon={faBullhorn} />,
    [OwidGdocType.Profile]: <FontAwesomeIcon icon={faFileLines} />,
}

function canTagGdoc(gdoc: OwidGdocIndexItem): boolean {
    return checkCanTagGdocType(gdoc.type)
}

function isGdocScheduled(gdoc: OwidGdocIndexItem, now: number): boolean {
    return (
        gdoc.published &&
        !!gdoc.publishedAt &&
        new Date(gdoc.publishedAt).getTime() > now
    )
}

function getTagWarning(
    gdoc: OwidGdocIndexItem,
    orphanTagIds: ReadonlySet<number>
): string | undefined {
    if (!gdoc.tags?.length) {
        return (
            "This document has no tags. " +
            "Without any topic tags, this document will not be filterable in the search or latest page."
        )
    }
    if (gdoc.tags.every((tag) => orphanTagIds.has(tag.id))) {
        return (
            "This document has only orphan tags. " +
            "Without any topic tags, this document will not be filterable in the search or latest page."
        )
    }
    return undefined
}

interface GdocsIndexRowProps {
    gdoc: OwidGdocIndexItem
    basePath: string
    orphanTagIds: ReadonlySet<number>
    availableTags: MinimalTagWithMetadata[]
    tagGraphRolesById: ReadonlyMap<number, TagGraphRole>
    onUpdateTags: (gdocId: string, tags: DbChartTagJoin[]) => Promise<void>
    canEditTags?: boolean
}

export function GdocsIndexRow({
    gdoc,
    basePath,
    orphanTagIds,
    availableTags,
    tagGraphRolesById,
    onUpdateTags,
    canEditTags = true,
}: GdocsIndexRowProps): React.ReactElement {
    const isScheduled = isGdocScheduled(gdoc, Date.now())
    const tagWarning = getTagWarning(gdoc, orphanTagIds)

    return (
        <div
            className={cx("gdoc-index-item", {
                [`gdoc-index-item__${gdoc.type}`]: gdoc.type,
            })}
        >
            <div className="gdoc-index-item__content">
                {gdoc.type ? (
                    <span
                        className="gdoc-index-item__type-icon"
                        title={gdoc.type}
                    >
                        {iconGdocTypeMap[gdoc.type]}
                    </span>
                ) : null}
                <Link to={`${basePath}/${gdoc.id}/preview`}>
                    <h5
                        className="gdoc-index-item__title"
                        title="Preview article"
                    >
                        {gdoc.title || "Untitled"}
                    </h5>
                </Link>
                <GdocsEditLink gdocId={gdoc.id} />
                <p className="gdoc-index-item__byline">
                    {gdoc.authors?.join(", ")}
                </p>
                <div className="gdoc-index-item__tags">
                    {canTagGdoc(gdoc) && canEditTags ? (
                        <>
                            {tagWarning && (
                                <span className="gdoc-index-item__tagging-warning">
                                    <FontAwesomeIcon
                                        icon={faTriangleExclamation}
                                    />{" "}
                                    <span>{tagWarning}</span>
                                </span>
                            )}
                            <EditableTags
                                tags={gdoc.tags}
                                onSave={(tags) => onUpdateTags(gdoc.id, tags)}
                                suggestions={availableTags}
                                tagGraphRolesById={tagGraphRolesById}
                            />
                        </>
                    ) : null}
                </div>
            </div>
            <div className="gdoc-index-item__publish-status">
                {gdoc.published ? (
                    isScheduled ? (
                        <span className="gdoc-index-item__scheduled-label">
                            Scheduled for{" "}
                            {new Date(gdoc.publishedAt!).toLocaleDateString(
                                "en-GB",
                                {
                                    weekday: "long",
                                    day: "numeric",
                                    month: "long",
                                    year: "numeric",
                                }
                            )}
                        </span>
                    ) : gdoc.type === OwidGdocType.Fragment ? (
                        <span className="gdoc-index-item__publish-link">
                            Published
                        </span>
                    ) : (
                        <a
                            title={
                                gdoc.publishedAt
                                    ? new Date(gdoc.publishedAt).toDateString()
                                    : undefined
                            }
                            href={`${BAKED_BASE_URL}/${gdoc.slug}`}
                            className="gdoc-index-item__publish-link"
                        >
                            Published
                        </a>
                    )
                ) : null}
            </div>
        </div>
    )
}
