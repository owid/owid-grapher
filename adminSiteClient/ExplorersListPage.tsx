import { LoadingIndicator } from "@ourworldindata/grapher"
import {
    dayjs,
    debounce,
    orderBy,
    SerializedGridProgram,
} from "@ourworldindata/utils"
import {
    action,
    computed,
    IReactionDisposer,
    observable,
    reaction,
    runInAction,
} from "mobx"
import { observer } from "mobx-react"
import { Component } from "react"
import {
    DefaultNewExplorerSlug,
    ExplorersRouteResponse,
    EXPLORERS_GIT_CMS_FOLDER,
    EXPLORERS_PREVIEW_ROUTE,
    EXPLORERS_ROUTE_FOLDER,
    GetAllExplorersRoute,
    UNSAVED_EXPLORER_DRAFT,
    ExplorerProgram,
} from "@ourworldindata/explorer"
import { GitCmsClient } from "../gitCms/GitCmsClient.js"
import {
    GIT_CMS_BASE_ROUTE,
    GIT_CMS_DEFAULT_BRANCH,
    GIT_CMS_REPO_URL,
} from "../gitCms/GitCmsConstants.js"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { AdminManager } from "./AdminManager.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

// export interface AdminManager {
//     loadingIndicatorSetting?: "loading" | "off" | "default"
// }

@observer
class ExplorerRow extends Component<{
    explorer: ExplorerProgram
    indexPage: ExplorersIndexPage
    gitCmsBranchName: string
    searchHighlight?: (text: string) => any
}> {
    render() {
        const { explorer, searchHighlight, gitCmsBranchName, indexPage } =
            this.props
        const {
            slug,
            lastCommit,
            filename,
            googleSheet,
            isPublished,
            explorerTitle,
            title,
            grapherCount,
            tableCount,
        } = explorer

        const publishedUrl = `${BAKED_BASE_URL}/${EXPLORERS_ROUTE_FOLDER}/${slug}`
        const repoPath = `${GIT_CMS_REPO_URL}/commits/${gitCmsBranchName}/${EXPLORERS_GIT_CMS_FOLDER}/`
        const lastCommitLink = `${GIT_CMS_REPO_URL}/commit/${lastCommit?.hash}`

        const titleToShow = explorerTitle ?? title ?? ""

        const fileHistoryButton = (
            <a key="explorers" href={repoPath + filename}>
                Full History
            </a>
        )

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
                        <a href={lastCommitLink}>
                            {lastCommit ? dayjs(lastCommit.date).fromNow() : ""}
                        </a>{" "}
                        by {lastCommit?.author_name} | {fileHistoryButton}
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
                        onClick={() =>
                            indexPage.togglePublishedStatus(filename)
                        }
                    >
                        {isPublished ? "Unpublish" : "Publish"}
                    </button>
                </td>
                <td>
                    <button
                        className="btn btn-danger"
                        onClick={() => indexPage.deleteFile(filename)}
                    >
                        Delete{" "}
                    </button>
                </td>
            </tr>
        )
    }
}

@observer
class ExplorerList extends Component<{
    explorers: ExplorerProgram[]
    searchHighlight?: (text: string) => any
    indexPage: ExplorersIndexPage
    gitCmsBranchName: string
}> {
    render() {
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
                            gitCmsBranchName={props.gitCmsBranchName}
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
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable explorers: ExplorerProgram[] = []
    @observable needsPull = false
    @observable maxVisibleRows = 50
    @observable numTotalRows?: number
    @observable searchInput?: string
    @observable highlightSearch?: string
    private gitCmsClient = new GitCmsClient(GIT_CMS_BASE_ROUTE)

    @computed get explorersToShow(): ExplorerProgram[] {
        return orderBy(
            this.explorers,
            (program) => dayjs(program.lastCommit?.date).unix(),
            ["desc"]
        )
    }

    @action.bound onShowMore() {
        this.maxVisibleRows += 100
    }

    @action.bound private async pullFromGithub() {
        const result = await this.gitCmsClient.pullFromGithub()
        alert(JSON.stringify(result))
        window.location.reload()
    }

    render() {
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
                            className="btn btn-secondary"
                            href="#"
                            onClick={this.pullFromGithub}
                        >
                            Pull updates from GitHub
                        </a>{" "}
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
                    gitCmsBranchName={this.gitCmsBranchName}
                />
                <a
                    href={`${GIT_CMS_REPO_URL}/commits/${this.gitCmsBranchName}`}
                >
                    See branch '{this.gitCmsBranchName}' history on GitHub
                </a>
                <br />
                <br />
            </main>
        )
    }

    @observable gitCmsBranchName = GIT_CMS_DEFAULT_BRANCH

    @observable isReady = false

    private async fetchAllExplorers() {
        const { searchInput } = this

        const response = await fetch(`/admin/${GetAllExplorersRoute}`)
        const json = (await response.json()) as ExplorersRouteResponse
        if (!json.success) alert(JSON.stringify(json.errorMessage))
        this.needsPull = json.needsPull
        this.isReady = true
        runInAction(() => {
            if (searchInput === this.searchInput) {
                this.explorers = json.explorers.map(
                    (exp: SerializedGridProgram) =>
                        ExplorerProgram.fromJson(exp)
                )
                this.numTotalRows = json.explorers.length
                this.highlightSearch = searchInput
                this.gitCmsBranchName = json.gitCmsBranchName
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

    @action.bound async togglePublishedStatus(filename: string) {
        const explorer = this.explorers.find(
            (exp) => exp.filename === filename
        )!
        const newVersion = explorer.setPublished(!explorer.isPublished)

        this.loadingModalOn()
        await this.gitCmsClient.writeRemoteFile({
            filepath: newVersion.fullPath,
            content: newVersion.toString(),
            commitMessage: `Setting publish status of ${filename} to ${newVersion.isPublished}`,
        })
        this.resetLoadingModal()
        await this.fetchAllExplorers()
    }

    @action.bound async deleteFile(filename: string) {
        if (!confirm(`Are you sure you want to delete "${filename}"?`)) return

        this.loadingModalOn()
        await this.gitCmsClient.deleteRemoteFile({
            filepath: `${EXPLORERS_GIT_CMS_FOLDER}/${filename}`,
        })
        this.resetLoadingModal()
        await this.fetchAllExplorers()
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.dispose = reaction(
            () => this.searchInput || this.maxVisibleRows,
            debounce(() => this.fetchAllExplorers(), 200)
        )
        void this.fetchAllExplorers()
    }

    componentWillUnmount() {
        this.dispose()
    }
}
