import * as React from "react"
import { observer } from "mobx-react"
import { Link } from "adminSite/client/Link"
import {
    AdminAppContext,
    AdminAppContextType,
} from "adminSite/client/AdminAppContext"
import {
    observable,
    computed,
    action,
    runInAction,
    reaction,
    IReactionDisposer,
} from "mobx"
import * as lodash from "lodash"
import { AdminLayout } from "adminSite/client/AdminLayout"
import { FieldsRow } from "adminSite/client/Forms"
import { getAvailableSlugSync, orderBy } from "grapher/utils/Util"
import {
    ExplorerProgram,
    SerializedExplorerProgram,
} from "explorer/client/ExplorerProgram"
import {
    deleteRemoteFile,
    pullFromGithub,
    writeRemoteFile,
} from "gitCms/GitCmsClient"
import { BAKED_BASE_URL } from "settings"
import {
    GIT_CMS_DEFAULT_BRANCH,
    GIT_CMS_REPO_URL,
} from "gitCms/GitCmsConstants"
import moment from "moment"
import {
    DefaultNewExplorerSlug,
    ExplorersRoute,
    ExplorersRouteResponse,
} from "explorer/client/ExplorerConstants"
import { LoadingIndicator } from "grapher/loadingIndicator/LoadingIndicator"

@observer
class ExplorerRow extends React.Component<{
    explorer: ExplorerProgram
    indexPage: ExplorersIndexPage
    gitCmsBranchName: string
    searchHighlight?: (text: string) => any
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
        const {
            explorer,
            searchHighlight,
            gitCmsBranchName,
            indexPage,
        } = this.props
        const {
            slug,
            lastCommit,
            filename,
            googleSheet,
            isPublished,
            title,
        } = explorer

        const publishedUrl = `${BAKED_BASE_URL}/explorers/${slug}`
        const repoPath = `${GIT_CMS_REPO_URL}/commits/${gitCmsBranchName}/explorers/`
        const lastCommitLink = `${GIT_CMS_REPO_URL}/commit/${lastCommit?.hash}`

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

        return (
            <tr>
                <td>
                    {!isPublished ? (
                        <span className="text-secondary">{slug}</span>
                    ) : (
                        <a href={publishedUrl}>{slug}</a>
                    )}
                </td>
                <td>
                    {searchHighlight ? searchHighlight(title || "") : title}
                </td>
                <td>
                    <a href={lastCommitLink}>
                        {lastCommit ? moment(lastCommit.date).fromNow() : ""}
                    </a>{" "}
                    by {lastCommit?.author_name} | {fileHistoryButton}
                    {googleSheetButton}
                </td>

                <td>
                    <Link
                        target="preview"
                        to={`/explorers/preview/${slug}`}
                        className="btn btn-secondary"
                    >
                        Preview
                    </Link>
                </td>

                <td>
                    <Link to={`/explorers/${slug}`} className="btn btn-primary">
                        Edit
                    </Link>
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
class ExplorerList extends React.Component<{
    explorers: ExplorerProgram[]
    searchHighlight?: (text: string) => any
    indexPage: ExplorersIndexPage
    gitCmsBranchName: string
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
        const { props } = this
        return (
            <table className="table table-bordered">
                <thead>
                    <tr>
                        <th>Slug</th>
                        <th>Title</th>
                        <th>Updated</th>
                        <th></th>
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
export class ExplorersIndexPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable explorers: ExplorerProgram[] = []
    @observable needsPull = false
    @observable maxVisibleRows = 50
    @observable numTotalRows?: number
    @observable searchInput?: string
    @observable highlightSearch?: string

    @computed get explorersToShow(): ExplorerProgram[] {
        return orderBy(
            this.explorers,
            (program) => moment(program.lastCommit?.date).unix(),
            ["desc"]
        )
    }

    @action.bound onShowMore() {
        this.maxVisibleRows += 100
    }

    @action.bound private async pullFromGithub() {
        const result = await pullFromGithub()
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
                            /[-\/\\^$*+?.()|[\]{}]/g,
                            "\\$&"
                        ),
                        "i"
                    ),
                    (s) => `<b>${s}</b>`
                )
                return <span dangerouslySetInnerHTML={{ __html: html }} />
            } else return text
        }

        const nextAvailableSlug = getAvailableSlugSync(
            DefaultNewExplorerSlug,
            this.explorersToShow.map((exp) => exp.slug)
        )

        const needsPull = true // todo: implement needsPull on server side and then use this.needsPull
        const pullButton = needsPull && (
            <span>
                |{" "}
                <a href="#" onClick={this.pullFromGithub}>
                    Check for new commits from GitHub
                </a>{" "}
            </span>
        )

        return (
            <AdminLayout title="Explorers">
                <main className="DatasetsIndexPage">
                    <FieldsRow>
                        <span>
                            Showing {explorersToShow.length} of {numTotalRows}{" "}
                            explorers |{" "}
                            <Link to={`/explorers/${nextAvailableSlug}`}>
                                New
                            </Link>{" "}
                            {pullButton}|{" "}
                            <a
                                href={`${GIT_CMS_REPO_URL}/commits/${this.gitCmsBranchName}`}
                            >
                                See branch '{this.gitCmsBranchName}' history on
                                GitHub
                            </a>
                        </span>
                    </FieldsRow>
                    <ExplorerList
                        explorers={explorersToShow}
                        searchHighlight={highlight}
                        indexPage={this}
                        gitCmsBranchName={this.gitCmsBranchName}
                    />
                </main>
            </AdminLayout>
        )
    }

    @observable gitCmsBranchName = GIT_CMS_DEFAULT_BRANCH

    @observable isReady = false

    private async getData() {
        const { searchInput } = this
        const json = (await this.context.admin.getJSON(
            `/api/${ExplorersRoute}`
        )) as ExplorersRouteResponse
        if (!json.success) alert(JSON.stringify(json.errorMessage))
        this.needsPull = json.needsPull
        this.isReady = true
        runInAction(() => {
            if (searchInput === this.searchInput) {
                this.explorers = json.explorers.map(
                    (exp: SerializedExplorerProgram) =>
                        ExplorerProgram.fromJson(exp)
                )
                this.numTotalRows = json.explorers.length
                this.highlightSearch = searchInput
                this.gitCmsBranchName = json.gitCmsBranchName
            }
        })
    }

    @action.bound async togglePublishedStatus(filename: string) {
        const explorer = this.explorers.find(
            (exp) => exp.filename === filename
        )!
        const newVersion = explorer.setPublished(!explorer.isPublished)

        this.context.admin.loadingIndicatorSetting = "loading"
        await writeRemoteFile({
            filepath: newVersion.fullPath,
            content: newVersion.toString(),
            commitMessage: `Setting publish status of ${filename} to ${newVersion.isPublished}`,
        })
        this.context.admin.loadingIndicatorSetting = "default"
        this.getData()
    }

    @action.bound async deleteFile(filename: string) {
        if (!confirm(`Are you sure you want to delete "${filename}"?`)) return

        this.context.admin.loadingIndicatorSetting = "loading"
        await deleteRemoteFile({ filepath: `explorers/${filename}` })
        this.context.admin.loadingIndicatorSetting = "default"
        this.getData()
    }

    dispose!: IReactionDisposer
    componentDidMount() {
        this.dispose = reaction(
            () => this.searchInput || this.maxVisibleRows,
            lodash.debounce(() => this.getData(), 200)
        )
        this.getData()
    }

    componentWillUnmount() {
        this.dispose()
    }
}
