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
import { getAvailableSlugSync } from "grapher/utils/Util"
import { ExplorerProgram } from "explorer/client/ExplorerProgram"
import {
    deleteRemoteFile,
    pullFromGithub,
    writeRemoteFile,
} from "gitCms/client"
import { BAKED_BASE_URL } from "settings"
import { GIT_CMS_DEFAULT_BRANCH, GIT_CMS_REPO_URL } from "gitCms/constants"

@observer
class ExplorerRow extends React.Component<{
    explorer: ExplorerProgram
    indexPage: ExplorersIndexPage
    gitCmsBranchName?: string
    searchHighlight?: (text: string) => any
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    render() {
        const { explorer, searchHighlight, gitCmsBranchName } = this.props

        const publishedUrl = `${BAKED_BASE_URL}/explorers/${explorer.slug}`

        const repoPath = `${GIT_CMS_REPO_URL}/commits/${
            gitCmsBranchName ?? GIT_CMS_DEFAULT_BRANCH
        }/explorers/`

        return (
            <tr>
                <td>
                    {!explorer.isPublished ? (
                        <span className="text-secondary">
                            Unpublished: {explorer.slug}
                        </span>
                    ) : (
                        <a href={publishedUrl}>{explorer.slug}</a>
                    )}
                </td>
                <td>
                    {searchHighlight
                        ? searchHighlight(explorer.title || "")
                        : explorer.title}
                </td>

                <td>
                    <Link
                        target="preview"
                        to={`/explorers/preview/${explorer.slug}`}
                        className="btn btn-secondary"
                    >
                        Preview
                    </Link>
                </td>

                <td>
                    <Link
                        to={`/explorers/${explorer.slug}`}
                        className="btn btn-primary"
                    >
                        Edit
                    </Link>
                </td>
                <td>
                    <button
                        className="btn btn-danger"
                        onClick={() =>
                            this.props.indexPage.togglePublishedStatus(
                                explorer.filename
                            )
                        }
                    >
                        {explorer.isPublished ? "Unpublish" : "Publish"}
                    </button>
                </td>
                <td>
                    <button
                        className="btn btn-danger"
                        onClick={() =>
                            this.props.indexPage.deleteFile(explorer.filename)
                        }
                    >
                        Delete{" "}
                    </button>
                </td>
                <td>
                    <a target="explorers" href={repoPath + explorer.filename}>
                        File History
                    </a>
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
    gitCmsBranchName?: string
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
                        <th></th>
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
    @observable maxVisibleRows = 50
    @observable numTotalRows?: number
    @observable searchInput?: string
    @observable highlightSearch?: string

    @computed get explorersToShow(): ExplorerProgram[] {
        return this.explorers
    }

    @action.bound onShowMore() {
        this.maxVisibleRows += 100
    }

    @action.bound private async pullFromGithub() {
        const result = await pullFromGithub()
        alert(JSON.stringify(result))
    }

    render() {
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
            "untitled",
            this.explorersToShow.map((exp) => exp.slug)
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
                            |{" "}
                            <a href="#" onClick={this.pullFromGithub}>
                                Pull from GitHub
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

    async getData() {
        const { searchInput } = this
        const json = await this.context.admin.getJSON("/api/explorers.json")
        runInAction(() => {
            if (searchInput === this.searchInput) {
                this.explorers = json.explorers.map(
                    (exp: any) => new ExplorerProgram(exp.slug, exp.program)
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
        explorer.isPublished = !explorer.isPublished

        this.context.admin.loadingIndicatorSetting = "loading"
        await writeRemoteFile({
            filepath: explorer.fullPath,
            content: explorer.toString(),
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
