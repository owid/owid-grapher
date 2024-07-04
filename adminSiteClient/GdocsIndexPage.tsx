import React from "react"
import cx from "classnames"
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
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    DbChartTagJoin,
    OwidGdocType,
    spansToUnformattedPlainText,
    checkIsGdocPost,
    OwidGdocIndexItem,
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
import { GdocsStoreContext } from "./GdocsStore.js"
import { computed, observable } from "mobx"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { GdocsEditLink } from "./GdocsEditLink.js"

const iconGdocTypeMap = {
    [OwidGdocType.Fragment]: <FontAwesomeIcon icon={faPuzzlePiece} />,
    [OwidGdocType.Article]: <FontAwesomeIcon icon={faNewspaper} />,
    [OwidGdocType.TopicPage]: <FontAwesomeIcon icon={faLightbulb} />,
    [OwidGdocType.LinearTopicPage]: <FontAwesomeIcon icon={faLightbulb} />,
    [OwidGdocType.DataInsight]: <FontAwesomeIcon icon={faThList} />,
    [OwidGdocType.Homepage]: <FontAwesomeIcon icon={faHouse} />,
    [OwidGdocType.AboutPage]: <FontAwesomeIcon icon={faBuildingNgo} />,
    [OwidGdocType.Author]: <FontAwesomeIcon icon={faUserPen} />,
}

enum GdocPublishStatus {
    All = "all",
    Published = "published",
    Unpublished = "unpublished",
}

@observer
class GdocsIndexPageSearch extends React.Component<{
    filters: GdocsSearchFilters
    search: { value: string }
}> {
    toggleGdocTypeFilter = (type: OwidGdocType) => {
        this.props.filters[type] = !this.props.filters[type]
    }

    render() {
        const owidGdocTypes: OwidGdocType[] = [
            OwidGdocType.Fragment,
            OwidGdocType.Article,
            OwidGdocType.TopicPage,
            OwidGdocType.LinearTopicPage,
            OwidGdocType.DataInsight,
            OwidGdocType.AboutPage,
            OwidGdocType.Author,
        ]
        return (
            <div className="d-flex flex-grow-1 flex-wrap">
                <SearchField
                    placeholder="Search by author, category, or title"
                    className="gdoc-index__search-bar"
                    value={this.props.search.value}
                    onValue={(value: string) =>
                        (this.props.search.value = value)
                    }
                    autofocus
                />
                <div className="gdoc-index-filters">
                    <p>
                        <strong>Filter results by type</strong>
                    </p>
                    {owidGdocTypes.map((type) => {
                        const isChecked = this.props.filters[type]
                        return (
                            <label
                                key={type}
                                className="gdoc-index-filter-checkbox"
                            >
                                <input
                                    type="checkbox"
                                    id={`shouldShow${type}`}
                                    checked={isChecked}
                                    onChange={() =>
                                        this.toggleGdocTypeFilter(type)
                                    }
                                />
                                {type}
                            </label>
                        )
                    })}
                    <label className="gdoc-index-filter-checkbox">
                        <select
                            id="shouldShowPublishedOnly"
                            onChange={({ target }) => {
                                const value = target.value as GdocPublishStatus
                                this.props.filters.publishStatus = value
                            }}
                        >
                            <option value={GdocPublishStatus.All}>All</option>
                            <option value={GdocPublishStatus.Published}>
                                Published
                            </option>
                            <option value={GdocPublishStatus.Unpublished}>
                                Unpublished
                            </option>
                        </select>
                    </label>
                </div>
            </div>
        )
    }
}

interface GdocsMatchParams {
    id: string
}

export type GdocsMatchProps = RouteComponentProps<GdocsMatchParams>

type GdocsSearchFilters = Record<OwidGdocType, boolean> & {
    publishStatus: GdocPublishStatus
}

@observer
export class GdocsIndexPage extends React.Component<GdocsMatchProps> {
    static contextType = GdocsStoreContext
    context!: React.ContextType<typeof GdocsStoreContext>

    @observable filters: GdocsSearchFilters = {
        [OwidGdocType.Fragment]: false,
        [OwidGdocType.Article]: false,
        [OwidGdocType.TopicPage]: false,
        [OwidGdocType.LinearTopicPage]: false,
        [OwidGdocType.DataInsight]: false,
        [OwidGdocType.Homepage]: false,
        [OwidGdocType.AboutPage]: false,
        [OwidGdocType.Author]: false,
        publishStatus: GdocPublishStatus.All,
    }

    @observable search = { value: "" }

    @computed get searchWords(): SearchWord[] {
        const { search } = this
        return buildSearchWordsFromSearchString(search.value)
    }

    async componentDidMount(): Promise<void> {
        await this.context?.fetchTags()
        await this.context?.fetchGdocs()
    }

    @computed
    get tags(): DbChartTagJoin[] {
        return this.context?.availableTags || []
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

                  switch (publishStatus) {
                      case GdocPublishStatus.All:
                          return shouldFilterByType
                      case GdocPublishStatus.Published:
                          return shouldFilterByType && isPublished
                      case GdocPublishStatus.Unpublished:
                          return shouldFilterByType && !isPublished
                  }
              })
            : context.gdocs

        if (searchWords.length > 0) {
            const filterFn = filterFunctionForSearchWords(
                searchWords,
                (gdoc: OwidGdocIndexItem) => {
                    const properties = [
                        gdoc.title,
                        gdoc.slug,
                        gdoc.authors?.join(" "),
                        gdoc.tags?.map(({ name }) => name).join(" "),
                        gdoc.id,
                    ]

                    if (checkIsGdocPost(gdoc)) {
                        properties.push(
                            ...[
                                gdoc.content.subtitle,
                                gdoc.content.summary
                                    ? spansToUnformattedPlainText(
                                          gdoc.content.summary.flatMap(
                                              (block) => block.value
                                          )
                                      )
                                    : undefined,
                            ]
                        )
                    }
                    return properties
                }
            )
            return filteredByType.filter(filterFn)
        } else {
            return filteredByType
        }
    }

    render() {
        return (
            <AdminLayout title="Google Docs">
                <main>
                    <div className="d-flex justify-content-between mb-3">
                        <GdocsIndexPageSearch
                            filters={this.filters}
                            search={this.search}
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

                    {this.allGdocsToShow.map((gdoc) => (
                        <div
                            key={gdoc.id}
                            className={cx(`gdoc-index-item`, {
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
                                <Link
                                    to={`${this.props.match.path}/${gdoc.id}/preview`}
                                >
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
                                <span className="gdoc-index-item__tags">
                                    {gdoc.type &&
                                    ![
                                        OwidGdocType.Fragment,
                                        OwidGdocType.AboutPage,
                                    ].includes(gdoc.type) &&
                                    gdoc.tags ? (
                                        <EditableTags
                                            tags={gdoc.tags}
                                            onSave={(tags) =>
                                                this.context?.updateTags(
                                                    gdoc,
                                                    tags as any
                                                )
                                            }
                                            suggestions={this.tags}
                                        />
                                    ) : null}
                                </span>
                            </div>
                            <div className="gdoc-index-item__publish-status">
                                {gdoc.published ? (
                                    <a
                                        title={
                                            gdoc.publishedAt
                                                ? new Date(
                                                      gdoc.publishedAt
                                                  ).toDateString()
                                                : undefined
                                        }
                                        href={
                                            gdoc.type !== OwidGdocType.Fragment
                                                ? `${BAKED_BASE_URL}/${gdoc.slug}`
                                                : undefined
                                        }
                                        className="gdoc-index-item__publish-link"
                                    >
                                        Published
                                    </a>
                                ) : null}
                            </div>
                        </div>
                    ))}

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
