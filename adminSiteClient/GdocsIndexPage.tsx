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
    handleCheckboxChange = (type: OwidGdocType) => {
        this.props.filters[type] = !this.props.filters[type]
    }

    render() {
        const owidGdocTypes: OwidGdocType[] = [
            OwidGdocType.Fragment,
            OwidGdocType.Article,
            OwidGdocType.TopicPage,
        ]

        return (
            <div className="d-flex flex-grow-1">
                <SearchField
                    placeholder="author, category, title"
                    className="gdoc-index__search-bar"
                    value={this.props.search.value}
                    onValue={(value: string) =>
                        (this.props.search.value = value)
                    }
                    autofocus
                />
                <div>
                    {owidGdocTypes.map((type) => {
                        const checked = this.props.filters[type]
                        return (
                            <label
                                key={type}
                                className={cx("gdoc-index-filter-checkbox", {
                                    checked,
                                })}
                            >
                                <input
                                    type="checkbox"
                                    id={`shouldShow${type}`}
                                    checked={checked}
                                    onChange={() =>
                                        this.handleCheckboxChange(type)
                                    }
                                />
                                {iconGdocTypeMap[type]}
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
        [OwidGdocType.Fragment]: true,
        [OwidGdocType.Article]: true,
        [OwidGdocType.TopicPage]: true,
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
                    `${gdoc.content.title} ${gdoc.content.byline} ${gdoc.tags
                        ?.map(({ name }) => name)
                        .join(" ")}`
                ),
            })
        }

        return searchIndex
    }

    @computed
    get visibleGdocs(): OwidGdocInterface[] {
        const { context, search, searchIndex } = this
        if (!context) return []
        const filteredByType = context.gdocs.filter((gdoc) => {
            if (!gdoc.content.type) return true
            if (this.filters[gdoc.content.type]) return true
            return false
        })
        if (!search.value) return filteredByType

        const fuzzysorted = fuzzysort.go(search.value, searchIndex, {
            limit: 50,
            key: "term",
        })

        const uniqueFiltered = fuzzysorted.reduce(
            (acc: Set<OwidGdocInterface>, { obj: { gdoc } }) => {
                if (!gdoc.content.type) return acc.add(gdoc)
                if (this.filters[gdoc.content.type]) return acc.add(gdoc)
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
                        <button
                            className="btn btn-primary"
                            onClick={() =>
                                this.props.history.push(
                                    `${this.props.match.path}/add`
                                )
                            }
                        >
                            <FontAwesomeIcon icon={faCirclePlus} /> Add document
                        </button>
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
                                    <span className="gdoc-index-item__type-icon">
                                        {iconGdocTypeMap[gdoc.content.type]}
                                    </span>
                                ) : null}
                                <Link
                                    to={`${this.props.match.path}/${gdoc.id}/preview`}
                                >
                                    <h5 className="gdoc-index-item__title">
                                        {gdoc.content.title}
                                    </h5>
                                </Link>
                                <a
                                    href={`https://docs.google.com/document/d/${gdoc.id}/edit`}
                                    className="gdoc-index-item__edit-link"
                                >
                                    Edit
                                </a>
                                <p className="gdoc-index-item__byline">
                                    {gdoc.content.byline}
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
