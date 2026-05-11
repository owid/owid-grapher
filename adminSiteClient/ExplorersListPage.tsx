import * as _ from "lodash-es"
import { LoadingIndicator } from "@ourworldindata/components"
import { dayjs, SerializedGridProgram } from "@ourworldindata/utils"
import {
    action,
    computed,
    IReactionDisposer,
    observable,
    reaction,
    runInAction,
    makeObservable,
} from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import {
    DefaultNewExplorerSlug,
    ExplorerChartCreationMode,
    ExplorersRouteResponse,
    EXPLORERS_PREVIEW_ROUTE,
    EXPLORERS_ROUTE_FOLDER,
    GetAllExplorersRoute,
    UNSAVED_EXPLORER_DRAFT,
    ExplorerProgram,
} from "@ourworldindata/explorer"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { AdminManager } from "./AdminManager.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

interface ExplorerRowProps {
    explorer: ExplorerProgram
    indexPage: ExplorersIndexPage
    searchHighlight?: (text: string) => any
}

function explorerTypeBadge(mode: ExplorerChartCreationMode): {
    label: string
    className: string
} {
    switch (mode) {
        case ExplorerChartCreationMode.FromVariableIds:
            return { label: "Indicator", className: "badge badge-success" }
        case ExplorerChartCreationMode.FromGrapherId:
            return { label: "Grapher", className: "badge badge-secondary" }
        case ExplorerChartCreationMode.FromExplorerTableColumnSlugs:
            return { label: "CSV", className: "badge badge-secondary" }
    }
}

type SortColumn = "type" | "lastUpdated"
type SortDirection = "asc" | "desc"

@observer
class ExplorerRow extends Component<ExplorerRowProps> {
    override render() {
        const { explorer, searchHighlight, indexPage } = this.props
        const {
            slug,
            lastCommit,
            googleSheet,
            isPublished,
            explorerTitle,
            title,
            grapherCount,
            tableCount,
        } = explorer

        const publishedUrl = `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${slug}`

        const titleToShow = explorerTitle ?? title ?? ""

        const googleSheetButton = googleSheet ? (
            <>
                <span> | </span>
                <a key="googleSheets" href={googleSheet}>
                    Google Sheet
                </a>
            </>
        ) : null

        const hasEdits = localStorage.getItem(
            `${UNSAVED_EXPLORER_DRAFT}${slug}`
        )

        return (
            <tr>
                <td>
                    {!isPublished ? (
                        <span className="text-secondary">{slug}</span>
                    ) : (
                        <a href={publishedUrl}>{slug}</a>
                    )}
                    {" - "}
                    <a href={`/admin/${EXPLORERS_PREVIEW_ROUTE}/${slug}`}>
                        Preview
                    </a>
                </td>
                <td>
                    {searchHighlight
                        ? searchHighlight(titleToShow)
                        : titleToShow}
                    <div style={{ fontSize: "80%", opacity: 0.8 }}>
                        {`${grapherCount} grapher${
                            grapherCount > 1 ? "s" : ""
                        }. ${tableCount} table${tableCount === 1 ? "" : "s"}.`}
                    </div>
                </td>
                <td>
                    {(() => {
                        const { label, className } = explorerTypeBadge(
                            explorer.chartCreationMode
                        )
                        return <span className={className}>{label}</span>
                    })()}
                </td>
                <td>
                    <div>{lastCommit?.message}</div>
                    <div style={{ fontSize: "80%", opacity: 0.8 }}>
                        <a>
                            {lastCommit ? dayjs(lastCommit.date).fromNow() : ""}
                        </a>{" "}
                        by {lastCommit?.author_name}
                        {googleSheetButton}
                    </div>
                </td>

                <td>
                    <a
                        href={`${EXPLORERS_ROUTE_FOLDER}/${slug}`}
                        className="btn btn-primary"
                        title={hasEdits ? "*You have local edits" : ""}
                    >
                        Edit{hasEdits ? "*" : ""}
                    </a>
                </td>
                <td>
                    <button
                        className="btn btn-danger"
                        onClick={() => indexPage.togglePublishedStatus(slug)}
                    >
                        {isPublished ? "Unpublish" : "Publish"}
                    </button>
                </td>
                <td>
                    <button
                        className="btn btn-danger"
                        onClick={() => indexPage.deleteExplorer(slug)}
                    >
                        Delete{" "}
                    </button>
                </td>
            </tr>
        )
    }
}

interface ExplorerListProps {
    explorers: ExplorerProgram[]
    searchHighlight?: (text: string) => any
    indexPage: ExplorersIndexPage
}

@observer
class ExplorerList extends Component<ExplorerListProps> {
    sortIndicator(column: SortColumn) {
        const { indexPage } = this.props
        if (indexPage.sortBy !== column) return null
        return indexPage.sortDirection === "asc" ? " ↑" : " ↓"
    }

    override render() {
        const { props } = this
        const { indexPage } = props
        const sortableHeaderStyle = {
            cursor: "pointer",
            userSelect: "none" as const,
        }
        return (
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th>Slug</th>
                        <th>Title</th>
                        <th
                            style={sortableHeaderStyle}
                            onClick={() => indexPage.onSort("type")}
                        >
                            Type{this.sortIndicator("type")}
                        </th>
                        <th
                            style={sortableHeaderStyle}
                            onClick={() => indexPage.onSort("lastUpdated")}
                        >
                            Last Updated{this.sortIndicator("lastUpdated")}
                        </th>
                        <th></th>
                        <th></th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    {props.explorers.map((explorer) => (
                        <ExplorerRow
                            indexPage={this.props.indexPage}
                            key={explorer.slug}
                            explorer={explorer}
                            searchHighlight={props.searchHighlight}
                        />
                    ))}
                </tbody>
            </table>
        )
    }
}

@observer
export class ExplorersIndexPage extends Component<{
    manager?: AdminManager
}> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    explorers: ExplorerProgram[] = []
    maxVisibleRows = 50
    numTotalRows: number | undefined = undefined
    searchInput: string | undefined = undefined
    highlightSearch: string | undefined = undefined
    sortBy: SortColumn = "lastUpdated"
    sortDirection: SortDirection = "desc"
    showOnlyPublished = false

    constructor(props: { manager?: AdminManager }) {
        super(props)

        makeObservable(this, {
            explorers: observable,
            maxVisibleRows: observable,
            numTotalRows: observable,
            searchInput: observable,
            highlightSearch: observable,
            isReady: observable,
            sortBy: observable,
            sortDirection: observable,
            showOnlyPublished: observable,
        })
    }

    @computed get explorersToShow(): ExplorerProgram[] {
        const filtered = this.showOnlyPublished
            ? this.explorers.filter((exp) => exp.isPublished)
            : this.explorers
        const sortValue =
            this.sortBy === "type"
                ? (program: ExplorerProgram) =>
                      explorerTypeBadge(program.chartCreationMode).label
                : (program: ExplorerProgram) =>
                      dayjs(program.lastCommit?.date).unix()
        return _.orderBy(filtered, sortValue, [this.sortDirection])
    }

    @action.bound onShowMore() {
        this.maxVisibleRows += 100
    }

    @action.bound onSort(column: SortColumn) {
        if (this.sortBy === column) {
            this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc"
        } else {
            this.sortBy = column
            this.sortDirection = column === "lastUpdated" ? "desc" : "asc"
        }
    }

    @action.bound onToggleShowOnlyPublished() {
        this.showOnlyPublished = !this.showOnlyPublished
    }

    override render() {
        if (!this.isReady)
            return <LoadingIndicator title="Loading explorer list" />

        const { explorersToShow, numTotalRows } = this

        const highlight = (text: string) => {
            if (this.highlightSearch) {
                const html = text.replace(
                    new RegExp(
                        this.highlightSearch.replace(
                            /[-/\\^$*+?.()|[\]{}]/g,
                            "\\$&"
                        ),
                        "i"
                    ),
                    (s) => `<b>${s}</b>`
                )
                return <span dangerouslySetInnerHTML={{ __html: html }} />
            } else return text
        }

        return (
            <main className="DatasetsIndexPage">
                <div className="ExplorersListPageHeader">
                    <div>
                        Showing {explorersToShow.length} of {numTotalRows}{" "}
                        explorers
                    </div>
                    <div>
                        <label
                            style={{
                                marginBottom: 0,
                                cursor: "pointer",
                                userSelect: "none",
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={this.showOnlyPublished}
                                onChange={this.onToggleShowOnlyPublished}
                                style={{ marginRight: 6 }}
                            />
                            Show only published
                        </label>
                    </div>
                    <div style={{ textAlign: "right" }}>
                        <a
                            className="btn btn-primary"
                            href={`/admin/${EXPLORERS_ROUTE_FOLDER}/${DefaultNewExplorerSlug}`}
                        >
                            Create
                        </a>
                    </div>
                </div>
                <ExplorerList
                    explorers={explorersToShow}
                    searchHighlight={highlight}
                    indexPage={this}
                />
                <br />
                <br />
            </main>
        )
    }

    isReady = false

    private async fetchAllExplorers() {
        const { searchInput } = this

        const response = await fetch(`/admin/${GetAllExplorersRoute}`)
        const json = (await response.json()) as ExplorersRouteResponse
        if (!json.success) alert(JSON.stringify(json.errorMessage))
        this.isReady = true
        runInAction(() => {
            if (searchInput === this.searchInput) {
                this.explorers = json.explorers.map(
                    (exp: SerializedGridProgram) =>
                        ExplorerProgram.fromJson(exp)
                )
                this.numTotalRows = json.explorers.length
                this.highlightSearch = searchInput
            }
        })
    }

    @computed private get manager() {
        return this.props.manager ?? {}
    }

    @action.bound private loadingModalOn() {
        this.manager.loadingIndicatorSetting = "loading"
    }

    @action.bound private resetLoadingModal() {
        this.manager.loadingIndicatorSetting = "default"
    }

    @action.bound async togglePublishedStatus(slug: string) {
        const explorer = this.explorers.find((exp) => exp.slug === slug)!
        const newVersion = explorer.setPublished(!explorer.isPublished)

        this.loadingModalOn()

        // Call the API to save the explorer
        const commitMessage = `Setting publish status of ${explorer.slug} to ${newVersion.isPublished}`

        const res = await this.context.admin.requestJSON(
            `/api/explorers/${explorer.slug}`,
            {
                tsv: newVersion.toString(),
                commitMessage: commitMessage,
            },
            "PUT"
        )

        if (!res.success) {
            alert(`Saving the explorer failed!\n\n${res.error}`)
            return
        }

        this.resetLoadingModal()
        await this.fetchAllExplorers()
    }

    @action.bound async deleteExplorer(slug: string) {
        if (!confirm(`Are you sure you want to delete "${slug}"?`)) return

        this.loadingModalOn()

        await this.context.admin.requestJSON(
            `/api/explorers/${slug}`,
            {},
            "DELETE"
        )
        this.resetLoadingModal()
        await this.fetchAllExplorers()
    }

    dispose!: IReactionDisposer
    override componentDidMount() {
        this.dispose = reaction(
            () => this.searchInput || this.maxVisibleRows,
            _.debounce(() => this.fetchAllExplorers(), 200)
        )
        void this.fetchAllExplorers()
    }

    override componentWillUnmount() {
        this.dispose()
    }
}
