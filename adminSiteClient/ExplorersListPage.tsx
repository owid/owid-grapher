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
    override render() {
        const { props } = this
        return (
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th>Slug</th>
                        <th>Title</th>
                        <th>Last Updated</th>
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

    @observable explorers: ExplorerProgram[] = []
    @observable maxVisibleRows = 50
    @observable numTotalRows?: number
    @observable searchInput?: string
    @observable highlightSearch?: string

    constructor(props: { manager?: AdminManager }) {
        super(props)
        makeObservable(this)
    }

    @computed get explorersToShow(): ExplorerProgram[] {
        return _.orderBy(
            this.explorers,
            (program) => dayjs(program.lastCommit?.date).unix(),
            ["desc"]
        )
    }

    @action.bound onShowMore() {
        this.maxVisibleRows += 100
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

    @observable isReady = false

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
