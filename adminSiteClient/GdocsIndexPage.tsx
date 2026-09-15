import * as React from "react"
import { AdminLayout } from "./AdminLayout.js"
import { Modal, TextField } from "./Forms.js"
import { faCirclePlus, faQuestion } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { OwidGdocType, OwidGdocIndexItem } from "@ourworldindata/utils"
import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
} from "../adminShared/search.js"
import { Route, RouteComponentProps } from "react-router-dom"
import { GdocsAdd } from "./GdocsAdd.js"
import { GdocsList } from "./GdocsList.js"
import { useGdocs } from "./gdocsQueries.js"

enum GdocPublishStatus {
    All = "all",
    Published = "published",
    Unpublished = "unpublished",
    Scheduled = "scheduled",
}

type GdocsSearchFilters = Record<OwidGdocType, boolean> & {
    publishStatus: GdocPublishStatus
}

interface GdocsIndexPageSearchProps {
    filters: GdocsSearchFilters
    searchValue: string
    onSearchValueChange: (value: string) => void
    onToggleGdocTypeFilter: (type: OwidGdocType) => void
    onPublishStatusChange: (status: GdocPublishStatus) => void
}

const DEFAULT_FILTERS: GdocsSearchFilters = {
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

const VISIBLE_RESULT_COUNT_INCREMENT = 100

function GdocsIndexPageSearch({
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
            <TextField
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
                {owidGdocTypes.map((type) => (
                    <label key={type} className="gdoc-index-filter-checkbox">
                        <input
                            type="checkbox"
                            id={`shouldShow${type}`}
                            checked={filters[type]}
                            onChange={() => onToggleGdocTypeFilter(type)}
                        />
                        {type}
                    </label>
                ))}
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

function filterGdocs(
    gdocs: OwidGdocIndexItem[],
    filters: GdocsSearchFilters,
    searchValue: string
): OwidGdocIndexItem[] {
    const { publishStatus, ...typeFilters } = filters
    const areAnyTypeFiltersActive = Object.values(typeFilters).some(Boolean)
    const shouldUseFilters =
        areAnyTypeFiltersActive || publishStatus !== GdocPublishStatus.All
    const now = Date.now()

    const filteredByType = shouldUseFilters
        ? gdocs.filter((gdoc) => {
              const shouldFilterByType =
                  !areAnyTypeFiltersActive || !gdoc.type || filters[gdoc.type]
              const isScheduled = isGdocScheduled(gdoc, now)

              switch (publishStatus) {
                  case GdocPublishStatus.All:
                      return shouldFilterByType
                  case GdocPublishStatus.Published:
                      return (
                          shouldFilterByType && gdoc.published && !isScheduled
                      )
                  case GdocPublishStatus.Unpublished:
                      return shouldFilterByType && !gdoc.published
                  case GdocPublishStatus.Scheduled:
                      return shouldFilterByType && isScheduled
              }
          })
        : gdocs

    const searchWords = buildSearchWordsFromSearchString(searchValue)
    const searched = searchWords.length
        ? filteredByType.filter(
              filterFunctionForSearchWords(searchWords, (gdoc) => [
                  gdoc.title,
                  gdoc.subtitle,
                  gdoc.slug,
                  gdoc.authors?.join(" "),
                  gdoc.tags?.map(({ name }) => name).join(" "),
                  gdoc.id,
              ])
          )
        : filteredByType

    return publishStatus === GdocPublishStatus.Scheduled
        ? [...searched].sort(
              (a, b) => getPublishedAtTimestamp(a) - getPublishedAtTimestamp(b)
          )
        : searched
}

export function GdocsIndexPage(props: RouteComponentProps): React.ReactElement {
    const [searchValue, setSearchValue] = React.useState("")
    const [filters, setFilters] =
        React.useState<GdocsSearchFilters>(DEFAULT_FILTERS)
    const [visibleResultCount, setVisibleResultCount] = React.useState(
        VISIBLE_RESULT_COUNT_INCREMENT
    )
    const deferredSearchValue = React.useDeferredValue(searchValue)
    const { data: gdocs = [] } = useGdocs()
    const gdocsToShow = React.useMemo(
        () => filterGdocs(gdocs, filters, deferredSearchValue),
        [gdocs, filters, deferredSearchValue]
    )

    const resetVisibleResults = (): void =>
        setVisibleResultCount(VISIBLE_RESULT_COUNT_INCREMENT)

    return (
        <AdminLayout title="Google Docs">
            <main>
                <div className="d-flex justify-content-between mb-3">
                    <GdocsIndexPageSearch
                        filters={filters}
                        searchValue={searchValue}
                        onSearchValueChange={(value) => {
                            setSearchValue(value)
                            resetVisibleResults()
                        }}
                        onToggleGdocTypeFilter={(type) => {
                            setFilters((current) => ({
                                ...current,
                                [type]: !current[type],
                            }))
                            resetVisibleResults()
                        }}
                        onPublishStatusChange={(publishStatus) => {
                            setFilters((current) => ({
                                ...current,
                                publishStatus,
                            }))
                            resetVisibleResults()
                        }}
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
                                props.history.push(`${props.match.path}/add`)
                            }
                        >
                            <FontAwesomeIcon icon={faCirclePlus} /> Add document
                        </button>
                    </div>
                </div>

                <GdocsList
                    gdocs={gdocsToShow.slice(0, visibleResultCount)}
                    basePath={props.match.path}
                />

                <div className="gdoc-index__load-more">
                    <p>
                        Showing{" "}
                        {Math.min(visibleResultCount, gdocsToShow.length)} of{" "}
                        {gdocsToShow.length} documents
                    </p>
                    {visibleResultCount < gdocsToShow.length && (
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() =>
                                setVisibleResultCount(
                                    (count) =>
                                        count + VISIBLE_RESULT_COUNT_INCREMENT
                                )
                            }
                        >
                            Load more
                        </button>
                    )}
                </div>

                <Route
                    path={`${props.match.path}/add`}
                    render={() => (
                        <Modal
                            onClose={() => props.history.push(props.match.path)}
                        >
                            <GdocsAdd
                                onAdd={(id) =>
                                    props.history.push(
                                        `${props.match.path}/${id}/preview`
                                    )
                                }
                            />
                        </Modal>
                    )}
                />
            </main>
        </AdminLayout>
    )
}
