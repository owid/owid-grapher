import * as React from "react"
import cx from "clsx"
import { AdminLayout } from "./AdminLayout.js"
import { Modal, SearchField } from "./Forms.js"
import { EditableTags } from "./EditableTags.js"
import {
    faCirclePlus,
    faHouse,
    faLightbulb,
    faNewspaper,
    faPuzzlePiece,
    faQuestion,
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
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    SearchWord,
} from "../adminShared/search.js"
import { Route, RouteComponentProps } from "react-router-dom"
import { Link } from "./Link.js"
import { GdocsAdd } from "./GdocsAdd.js"
import { observer } from "mobx-react"
import { GdocsStoreContext } from "./GdocsStoreContext.js"
import { action, computed, observable, makeObservable } from "mobx"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { GdocsEditLink } from "./GdocsEditLink.js"
import { getTagGraphRolesById } from "./TagGraphMetadata.js"

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

enum GdocPublishStatus {
    All = "all",
    Published = "published",
    Unpublished = "unpublished",
    Scheduled = "scheduled",
}

interface GdocsIndexPageSearchProps {
    filters: GdocsSearchFilters
    searchValue: string
    onSearchValueChange: (value: string) => void
    onToggleGdocTypeFilter: (type: OwidGdocType) => void
    onPublishStatusChange: (status: GdocPublishStatus) => void
}

const GdocsIndexPageSearch = observer(function GdocsIndexPageSearch({
    filters,
    searchValue,
    onSearchValueChange,
    onToggleGdocTypeFilter,
    onPublishStatusChange,
}: GdocsIndexPageSearchProps): React.ReactElement {
    const owidGdocTypes: OwidGdocType[] = [
        OwidGdocType.Fragment,
        OwidGdocType.Article,
        OwidGdocType.TopicPage,
        OwidGdocType.LinearTopicPage,
        OwidGdocType.DataInsight,
        OwidGdocType.AboutPage,
        OwidGdocType.Author,
        OwidGdocType.Announcement,
        OwidGdocType.Profile,
    ]
    return (
        <div className="d-flex flex-grow-1 flex-wrap">
            <SearchField
                placeholder="Search by author, category, or title"
                className="gdoc-index__search-bar"
                value={searchValue}
                onValue={onSearchValueChange}
                autofocus
            />
            <div className="gdoc-index-filters">
                <p>
                    <strong>Filter results by type</strong>
                </p>
                {owidGdocTypes.map((type) => {
                    const isChecked = filters[type]
                    return (
                        <label
                            key={type}
                            className="gdoc-index-filter-checkbox"
                        >
                            <input
                                type="checkbox"
                                id={`shouldShow${type}`}
                                checked={isChecked}
                                onChange={() => onToggleGdocTypeFilter(type)}
                            />
                            {type}
                        </label>
                    )
                })}
                <label className="gdoc-index-filter-checkbox">
                    <select
                        id="publishStatusFilter"
                        value={filters.publishStatus}
                        onChange={({ target }) =>
                            onPublishStatusChange(
                                target.value as GdocPublishStatus
                            )
                        }
                    >
                        <option value={GdocPublishStatus.All}>All</option>
                        <option value={GdocPublishStatus.Published}>
                            Published
                        </option>
                        <option value={GdocPublishStatus.Unpublished}>
                            Unpublished
                        </option>
                        <option value={GdocPublishStatus.Scheduled}>
                            Scheduled
                        </option>
                    </select>
                </label>
            </div>
        </div>
    )
})

type GdocsSearchFilters = Record<OwidGdocType, boolean> & {
    publishStatus: GdocPublishStatus
}

const VISIBLE_RESULT_COUNT_INCREMENT = 100

function canTagGdoc(gdoc: OwidGdocIndexItem): boolean {
    return (
        !!gdoc.type &&
        ![
            OwidGdocType.AboutPage,
            OwidGdocType.Author,
            OwidGdocType.Fragment,
            OwidGdocType.Homepage,
        ].includes(gdoc.type)
    )
}

function getPublishedAtTimestamp(gdoc: OwidGdocIndexItem): number {
    if (!gdoc.publishedAt) return Infinity
    const timestamp = new Date(gdoc.publishedAt).getTime()
    return Number.isNaN(timestamp) ? Infinity : timestamp
}

function isGdocScheduled(gdoc: OwidGdocIndexItem, now: number): boolean {
    return (
        gdoc.published &&
        !!gdoc.publishedAt &&
        new Date(gdoc.publishedAt).getTime() > now
    )
}

function TagWarning({
    gdoc,
    orphanTagIds,
}: {
    gdoc: OwidGdocIndexItem
    orphanTagIds?: ReadonlySet<number>
}): React.ReactElement | null {
    let warning
    if (!gdoc.tags?.length) {
        warning =
            "This document has no tags. " +
            "Without any topic tags, this document will not be filterable in the search or latest page."
    } else if (
        orphanTagIds &&
        gdoc.tags.every((tag) => orphanTagIds.has(tag.id))
    ) {
        warning =
            "This document has only orphan tags. " +
            "Without any topic tags, this document will not be filterable in the search or latest page."
    }

    if (!warning) return null

    return (
        <span className="gdoc-index-item__tagging-warning">
            <FontAwesomeIcon icon={faTriangleExclamation} />{" "}
            <span>{warning}</span>
        </span>
    )
}

interface GdocsIndexRowProps {
    gdoc: OwidGdocIndexItem
    basePath: string
    orphanTagIds?: ReadonlySet<number>
    availableTags: MinimalTagWithMetadata[]
    tagGraphRolesById: ReadonlyMap<number, TagGraphRole>
    onUpdateTags: (gdoc: OwidGdocIndexItem, tags: DbChartTagJoin[]) => void
}

const GdocsIndexRow = observer(function GdocsIndexRow({
    gdoc,
    basePath,
    orphanTagIds,
    availableTags,
    tagGraphRolesById,
    onUpdateTags,
}: GdocsIndexRowProps): React.ReactElement {
    const isScheduled = isGdocScheduled(gdoc, Date.now())

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
                    {canTagGdoc(gdoc) ? (
                        <>
                            <TagWarning
                                gdoc={gdoc}
                                orphanTagIds={orphanTagIds}
                            />
                            <EditableTags
                                tags={gdoc.tags}
                                onSave={(tags) => onUpdateTags(gdoc, tags)}
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
})

interface GdocsIndexPageContentProps extends RouteComponentProps {
    searchValue: string
    deferredSearchValue: string
    visibleResultCount: number
    onSearchValueChange: (value: string) => void
    onResetVisibleResults: () => void
    onLoadMore: () => void
}

@observer
class GdocsIndexPageContent extends React.Component<GdocsIndexPageContentProps> {
    static override contextType = GdocsStoreContext
    declare context: React.ContextType<typeof GdocsStoreContext>

    filters: GdocsSearchFilters = {
        [OwidGdocType.Fragment]: false,
        [OwidGdocType.Article]: false,
        [OwidGdocType.TopicPage]: false,
        [OwidGdocType.LinearTopicPage]: false,
        [OwidGdocType.DataInsight]: false,
        [OwidGdocType.Homepage]: false,
        [OwidGdocType.AboutPage]: false,
        [OwidGdocType.Author]: false,
        [OwidGdocType.Announcement]: false,
        [OwidGdocType.Profile]: false,
        publishStatus: GdocPublishStatus.All,
    }

    constructor(props: GdocsIndexPageContentProps) {
        super(props)

        makeObservable(this, {
            filters: observable,
        })
    }

    @computed get searchWords(): SearchWord[] {
        return buildSearchWordsFromSearchString(this.props.deferredSearchValue)
    }

    override async componentDidMount(): Promise<void> {
        await this.context?.fetchTags()
        await this.context?.fetchGdocs()
    }

    @action.bound
    private onToggleGdocTypeFilter(type: OwidGdocType): void {
        this.filters[type] = !this.filters[type]
        this.props.onResetVisibleResults()
    }

    @action.bound
    private onPublishStatusChange(status: GdocPublishStatus): void {
        this.filters.publishStatus = status
        this.props.onResetVisibleResults()
    }

    private readonly onUpdateTags = (
        gdoc: OwidGdocIndexItem,
        tags: DbChartTagJoin[]
    ): void => {
        void this.context?.updateTags(gdoc, tags)
    }

    @computed
    get tags(): MinimalTagWithMetadata[] {
        return this.context?.availableTags || []
    }

    @computed
    get tagGraphRolesById(): ReturnType<typeof getTagGraphRolesById> {
        return getTagGraphRolesById(this.tags)
    }

    @computed get allGdocsToShow(): OwidGdocIndexItem[] {
        const { searchWords, context } = this
        if (!context) return []

        // Don't filter unless at least one filter is active
        const { publishStatus, ...typeFilters } = this.filters
        const areAnyTypeFiltersActive = Object.values(typeFilters).some(
            (isFilterActive) => isFilterActive
        )
        const shouldUseFilters =
            areAnyTypeFiltersActive || publishStatus !== GdocPublishStatus.All

        const now = Date.now()
        const filteredByType = shouldUseFilters
            ? context.gdocs.filter((gdoc) => {
                  const isPublished = gdoc.published
                  const shouldFilterByType =
                      // don't filter if no type filters are active
                      !areAnyTypeFiltersActive ||
                      // don't filter gdocs with no type
                      !gdoc.type ||
                      // if any type filter is active, and the gdoc has a type,
                      // show this document if its type is active
                      this.filters[gdoc.type]

                  const isScheduled = isGdocScheduled(gdoc, now)

                  switch (publishStatus) {
                      case GdocPublishStatus.All:
                          return shouldFilterByType
                      case GdocPublishStatus.Published:
                          return (
                              shouldFilterByType && isPublished && !isScheduled
                          )
                      case GdocPublishStatus.Unpublished:
                          return shouldFilterByType && !isPublished
                      case GdocPublishStatus.Scheduled:
                          return shouldFilterByType && isScheduled
                  }
              })
            : context.gdocs

        if (searchWords.length > 0) {
            const filterFn = filterFunctionForSearchWords(
                searchWords,
                (gdoc: OwidGdocIndexItem) => {
                    return [
                        gdoc.title,
                        gdoc.subtitle,
                        gdoc.slug,
                        gdoc.authors?.join(" "),
                        gdoc.tags?.map(({ name }) => name).join(" "),
                        gdoc.id,
                    ]
                }
            )
            const result = filteredByType.filter(filterFn)
            return this.sortIfScheduled(result)
        } else {
            return this.sortIfScheduled(filteredByType)
        }
    }

    private sortIfScheduled(gdocs: OwidGdocIndexItem[]): OwidGdocIndexItem[] {
        if (this.filters.publishStatus === GdocPublishStatus.Scheduled) {
            return [...gdocs].sort(
                (a, b) =>
                    getPublishedAtTimestamp(a) - getPublishedAtTimestamp(b)
            )
        }
        return gdocs
    }

    override render() {
        return (
            <AdminLayout title="Google Docs">
                <main>
                    <div className="d-flex justify-content-between mb-3">
                        <GdocsIndexPageSearch
                            filters={this.filters}
                            searchValue={this.props.searchValue}
                            onSearchValueChange={this.props.onSearchValueChange}
                            onToggleGdocTypeFilter={this.onToggleGdocTypeFilter}
                            onPublishStatusChange={this.onPublishStatusChange}
                        />
                        <div>
                            <a
                                className="btn btn-secondary gdoc-index__help-link"
                                target="_blank"
                                href="https://docs.google.com/document/d/1OLoTWloy4VecOjKTjB1wLV6tEphHJIMXfexrf1ZYJzU/edit"
                                rel="noopener"
                            >
                                <FontAwesomeIcon icon={faQuestion} /> Open
                                documentation
                            </a>
                            <button
                                className="btn btn-primary"
                                onClick={() =>
                                    this.props.history.push(
                                        `${this.props.match.path}/add`
                                    )
                                }
                            >
                                <FontAwesomeIcon icon={faCirclePlus} /> Add
                                document
                            </button>
                        </div>
                    </div>

                    {this.allGdocsToShow
                        .slice(0, this.props.visibleResultCount)
                        .map((gdoc) => (
                            <GdocsIndexRow
                                key={gdoc.id}
                                gdoc={gdoc}
                                basePath={this.props.match.path}
                                orphanTagIds={this.context?.orphanTagIds}
                                availableTags={this.tags}
                                tagGraphRolesById={this.tagGraphRolesById}
                                onUpdateTags={this.onUpdateTags}
                            />
                        ))}

                    <div className="gdoc-index__load-more">
                        <p>
                            Showing{" "}
                            {Math.min(
                                this.props.visibleResultCount,
                                this.allGdocsToShow.length
                            )}{" "}
                            of {this.allGdocsToShow.length} documents
                        </p>
                        {this.props.visibleResultCount <
                            this.allGdocsToShow.length && (
                            <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={this.props.onLoadMore}
                            >
                                Load more
                            </button>
                        )}
                    </div>

                    <Route
                        path={`${this.props.match.path}/add`}
                        render={() => {
                            const onClose = () =>
                                this.props.history.push(this.props.match.path)

                            return (
                                <Modal onClose={onClose}>
                                    <GdocsAdd
                                        onAdd={(id: string) => {
                                            this.props.history.push(
                                                `${this.props.match.path}/${id}/preview`
                                            )
                                        }}
                                    />
                                </Modal>
                            )
                        }}
                    />
                </main>
            </AdminLayout>
        )
    }
}

export function GdocsIndexPage(props: RouteComponentProps): React.ReactElement {
    const [searchValue, setSearchValue] = React.useState("")
    const [visibleResultCount, setVisibleResultCount] = React.useState(
        VISIBLE_RESULT_COUNT_INCREMENT
    )
    const deferredSearchValue = React.useDeferredValue(searchValue)

    const resetVisibleResults = React.useCallback(() => {
        setVisibleResultCount(VISIBLE_RESULT_COUNT_INCREMENT)
    }, [])

    const handleSearchValueChange = React.useCallback((value: string) => {
        setSearchValue(value)
        setVisibleResultCount(VISIBLE_RESULT_COUNT_INCREMENT)
    }, [])

    const loadMore = React.useCallback(() => {
        setVisibleResultCount((count) => count + VISIBLE_RESULT_COUNT_INCREMENT)
    }, [])

    return (
        <GdocsIndexPageContent
            {...props}
            searchValue={searchValue}
            deferredSearchValue={deferredSearchValue}
            visibleResultCount={visibleResultCount}
            onSearchValueChange={handleSearchValueChange}
            onResetVisibleResults={resetVisibleResults}
            onLoadMore={loadMore}
        />
    )
}
