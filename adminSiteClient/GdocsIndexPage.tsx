import React from "react"
import cx from "classnames"
import { AdminLayout } from "./AdminLayout.js"
import { EditableTags, Modal, SearchField } from "./Forms.js"
import {
    faCirclePlus,
    faLightbulb,
    faNewspaper,
    faPuzzlePiece,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    OwidGdocTag,
    OwidGdocInterface,
    OwidGdocType,
} from "@ourworldindata/utils"
import { Route, RouteComponentProps } from "react-router-dom"
import { Link } from "./Link.js"
import { GdocsAdd } from "./GdocsAdd.js"
import { observer } from "mobx-react"
import { GdocsStoreContext } from "./GdocsStore.js"
import { computed, observable } from "mobx"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import fuzzysort from "fuzzysort"
import { GdocsEditLink } from "./GdocsEditLink.js"

const iconGdocTypeMap = {
    [OwidGdocType.Fragment]: <FontAwesomeIcon icon={faPuzzlePiece} />,
    [OwidGdocType.Article]: <FontAwesomeIcon icon={faNewspaper} />,
    [OwidGdocType.TopicPage]: <FontAwesomeIcon icon={faLightbulb} />,
}

interface Searchable {
    gdoc: OwidGdocInterface
    term?: Fuzzysort.Prepared
}

@observer
class GdocsIndexPageSearch extends React.Component<{
    filters: Record<OwidGdocType, boolean>
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
                </div>
            </div>
        )
    }
}

interface GdocsMatchParams {
    id: string
}

export type GdocsMatchProps = RouteComponentProps<GdocsMatchParams>

@observer
export class GdocsIndexPage extends React.Component<GdocsMatchProps> {
    static contextType = GdocsStoreContext
    context!: React.ContextType<typeof GdocsStoreContext>

    @observable filters: Record<OwidGdocType, boolean> = {
        [OwidGdocType.Fragment]: false,
        [OwidGdocType.Article]: false,
        [OwidGdocType.TopicPage]: false,
    }

    @observable search = { value: "" }

    async componentDidMount(): Promise<void> {
        await this.context?.fetchTags()
        await this.context?.fetchGdocs()
    }

    @computed
    get tags(): OwidGdocTag[] {
        return this.context?.availableTags || []
    }

    @computed get searchIndex(): Searchable[] {
        if (!this.context) return []
        const searchIndex: Searchable[] = []
        for (const gdoc of this.context.gdocs) {
            searchIndex.push({
                gdoc,
                term: fuzzysort.prepare(
                    `${gdoc.content.title} ${gdoc.content.authors?.join(
                        " "
                    )} ${gdoc.tags?.map(({ name }) => name).join(" ")}`
                ),
            })
        }

        return searchIndex
    }

    @computed
    get visibleGdocs(): OwidGdocInterface[] {
        const { context, search, searchIndex } = this
        if (!context) return []
        // Don't filter unless at least one filter is active
        const shouldUseFilters = !!Object.values(this.filters).find(
            (isFilterActive) => isFilterActive
        )

        const filteredByType = shouldUseFilters
            ? context.gdocs.filter(
                  (gdoc) =>
                      // don't filter docs with no type set
                      !gdoc.content.type || !!this.filters[gdoc.content.type]
              )
            : context.gdocs
        if (!search.value) return filteredByType

        const fuzzysorted = fuzzysort.go(search.value, searchIndex, {
            limit: 50,
            key: "term",
        })

        const uniqueFiltered = fuzzysorted.reduce(
            (acc: Set<OwidGdocInterface>, { obj: { gdoc } }) => {
                const shouldInclude =
                    // Don't filter unless at least one filter is active
                    !shouldUseFilters ||
                    !gdoc.content.type ||
                    this.filters[gdoc.content.type]

                if (shouldInclude) {
                    acc.add(gdoc)
                }

                return acc
            },
            new Set<OwidGdocInterface>()
        )

        return [...uniqueFiltered]
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

                    {this.visibleGdocs.map((gdoc) => (
                        <div
                            key={gdoc.id}
                            className={cx(`gdoc-index-item`, {
                                [`gdoc-index-item__${gdoc.content.type}`]:
                                    gdoc.content.type,
                            })}
                        >
                            <div className="gdoc-index-item__content">
                                {gdoc.content.type ? (
                                    <span
                                        className="gdoc-index-item__type-icon"
                                        title={gdoc.content.type}
                                    >
                                        {iconGdocTypeMap[gdoc.content.type]}
                                    </span>
                                ) : null}
                                <Link
                                    to={`${this.props.match.path}/${gdoc.id}/preview`}
                                >
                                    <h5
                                        className="gdoc-index-item__title"
                                        title="Preview article"
                                    >
                                        {gdoc.content.title}
                                    </h5>
                                </Link>
                                <GdocsEditLink gdocId={gdoc.id} />
                                <p className="gdoc-index-item__byline">
                                    {gdoc.content.authors?.join(", ")}
                                </p>
                                <span className="gdoc-index-item__tags">
                                    {gdoc.content.type !==
                                        OwidGdocType.Fragment && gdoc.tags ? (
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
                                            gdoc.content.type !==
                                            OwidGdocType.Fragment
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
