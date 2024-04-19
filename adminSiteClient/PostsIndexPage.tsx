import React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, runInAction } from "mobx"

import {
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    SearchWord,
    uniq,
    DbChartTagJoin,
} from "@ourworldindata/utils"
import { AdminLayout } from "./AdminLayout.js"
import { SearchField, FieldsRow, Timeago } from "./Forms.js"
import { EditableTags } from "./EditableTags.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { ADMIN_BASE_URL } from "../settings/clientSettings.js"
import { match } from "ts-pattern"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faEye,
    faChainBroken,
    faRecycle,
} from "@fortawesome/free-solid-svg-icons"

interface GDocSlugSuccessor {
    id: string
    published: boolean
}

interface PostIndexMeta {
    id: number
    title: string
    type: string
    status: string
    authors: string[] | null
    slug: string
    updatedAtInWordpress: string | null
    tags: DbChartTagJoin[] | null
    gdocSuccessorId: string | undefined
    gdocSuccessorPublished: boolean
    gdocSlugSuccessors: GDocSlugSuccessor[] | null
}

enum GdocStatus {
    "MISSING_NO_SLUG_SUCCESSOR" = "MISSING_NO_SLUG_SUCCESSOR",
    "MISSING_WITH_SLUG_SUCCESSOR" = "MISSING_WITH_SLUG_SUCCESSOR",
    "CONVERTING" = "CONVERTING",
    "CONVERTED" = "CONVERTED",
}

interface PostRowProps {
    post: PostIndexMeta
    availableTags: DbChartTagJoin[]
}

@observer
class PostRow extends React.Component<PostRowProps> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable private postGdocStatus: GdocStatus =
        GdocStatus.MISSING_NO_SLUG_SUCCESSOR

    constructor(props: PostRowProps) {
        super(props)
        this.postGdocStatus = props.post.gdocSuccessorId
            ? GdocStatus.CONVERTED
            : props.post.gdocSlugSuccessors &&
                props.post.gdocSlugSuccessors.length > 0
              ? GdocStatus.MISSING_WITH_SLUG_SUCCESSOR
              : GdocStatus.MISSING_NO_SLUG_SUCCESSOR
    }

    async saveTags(tags: DbChartTagJoin[]) {
        const { post } = this.props
        const json = await this.context.admin.requestJSON(
            `/api/posts/${post.id}/setTags`,
            { tagIds: tags.map((t) => t.id) },
            "POST"
        )
        if (json.success) {
            runInAction(() => (post.tags = tags))
        }
    }

    @action.bound onSaveTags(tags: DbChartTagJoin[]) {
        void this.saveTags(tags)
    }

    @action.bound async onConvertGdoc(allowRecreate: boolean = false) {
        this.postGdocStatus = GdocStatus.CONVERTING
        const { admin } = this.context
        const json = await admin.requestJSON(
            `/api/posts/${this.props.post.id}/createGdoc`,
            { allowRecreate },
            "POST"
        )
        this.postGdocStatus = GdocStatus.CONVERTED
        this.props.post.gdocSuccessorId = json.googleDocsId
    }

    @action.bound async onRecreateGdoc() {
        if (
            window.confirm(
                "This will overwrite the existing GDoc. Are you sure?"
            )
        ) {
            void this.onConvertGdoc(true)
        }
    }

    @action.bound async onUnlinkGdoc() {
        if (
            window.confirm(
                "This will unlink the GDoc that was created. The GDoc will NOT be deleted but it will no longer show up here. Are you sure?"
            )
        ) {
            this.postGdocStatus = GdocStatus.CONVERTING
            const { admin } = this.context
            await admin.requestJSON(
                `/api/posts/${this.props.post.id}/unlinkGdoc`,
                {},
                "POST"
            )
            this.postGdocStatus =
                this.props.post.gdocSlugSuccessors &&
                this.props.post.gdocSlugSuccessors.length > 0
                    ? GdocStatus.MISSING_WITH_SLUG_SUCCESSOR
                    : GdocStatus.MISSING_NO_SLUG_SUCCESSOR
            this.props.post.gdocSuccessorId = undefined
        }
    }

    render() {
        const { post, availableTags } = this.props
        const { postGdocStatus } = this
        const gdocElement = match(postGdocStatus)
            .with(GdocStatus.MISSING_NO_SLUG_SUCCESSOR, () => (
                <button
                    onClick={async () => await this.onConvertGdoc()}
                    className="btn btn-primary btn-sm"
                >
                    Create GDoc
                </button>
            ))
            .with(GdocStatus.MISSING_WITH_SLUG_SUCCESSOR, () => (
                <>
                    {uniq(post.gdocSlugSuccessors).map((gdocSlugSuccessor) => (
                        <a
                            key={gdocSlugSuccessor.id}
                            href={`${ADMIN_BASE_URL}/admin/gdocs/${gdocSlugSuccessor.id}/preview`}
                            className="btn btn-primary btn-sm"
                            title="Preview GDoc with same slug"
                        >
                            <>
                                <FontAwesomeIcon icon={faEye} /> Preview
                                {gdocSlugSuccessor.published ? (
                                    <span title="Published">✅</span>
                                ) : (
                                    <></>
                                )}
                            </>
                        </a>
                    ))}
                </>
            ))
            .with(GdocStatus.CONVERTING, () => <span>Converting...</span>)
            .with(GdocStatus.CONVERTED, () => (
                <>
                    <a
                        href={`${ADMIN_BASE_URL}/admin/gdocs/${post.gdocSuccessorId}/preview`}
                        className="btn btn-primary btn-sm button-with-margin"
                    >
                        <>
                            <FontAwesomeIcon icon={faEye} /> Preview
                            {post.gdocSuccessorPublished ? (
                                <span title="Published">✅</span>
                            ) : (
                                <></>
                            )}
                        </>
                    </a>
                    <button
                        onClick={this.onRecreateGdoc}
                        className="btn btn-primary alert-danger btn-sm button-with-margin"
                    >
                        <FontAwesomeIcon
                            icon={faRecycle}
                            title={
                                "Recreate the Gdoc, replacing existing content"
                            }
                        />
                    </button>
                    <button
                        onClick={this.onUnlinkGdoc}
                        className="btn btn-primary alert-danger btn-sm button-with-margin"
                    >
                        <FontAwesomeIcon
                            icon={faChainBroken}
                            title={"Unlink the GDoc"}
                        />
                    </button>
                </>
            ))
            .exhaustive()

        return (
            <tr>
                <td>{post.title || "(no title)"}</td>
                <td>{post.authors?.join(", ")}</td>
                <td>{post.type}</td>
                <td>{post.status}</td>
                <td>{post.slug}</td>
                <td style={{ minWidth: "380px" }}>
                    <EditableTags
                        tags={post.tags ?? []}
                        suggestions={availableTags}
                        onSave={this.onSaveTags}
                    />
                </td>
                <td>
                    <Timeago time={post.updatedAtInWordpress} />
                </td>
                <td>
                    <a
                        href={`/admin/posts/compare/${post.id}`}
                        target="_blank"
                        rel="noopener"
                    >
                        Compare view
                    </a>
                </td>
                <td>{gdocElement}</td>
                {/*<td>
                <button className="btn btn-danger" onClick={_ => this.props.onDelete(chart)}>Delete</button>
            </td>*/}
            </tr>
        )
    }
}

@observer
export class PostsIndexPage extends React.Component {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable posts: PostIndexMeta[] = []
    @observable maxVisibleRows = 50
    @observable searchInput?: string
    @observable availableTags: DbChartTagJoin[] = []

    @computed get searchWords(): SearchWord[] {
        const { searchInput } = this
        return buildSearchWordsFromSearchString(searchInput)
    }

    @computed get postsToShow(): PostIndexMeta[] {
        const { searchWords, posts } = this
        if (posts.length > 0 && searchWords.length > 0) {
            const filterFn = filterFunctionForSearchWords(
                searchWords,
                (post: PostIndexMeta) => [
                    post.title,
                    post.slug,
                    `${post.id}`,
                    post.authors?.join(" "),
                ]
            )
            return posts.filter(filterFn)
        } else {
            return posts
        }
    }

    @computed get postsToShowLimited(): PostIndexMeta[] {
        return this.postsToShow.slice(0, this.maxVisibleRows)
    }

    @computed get numTotalRows(): number {
        return this.posts.length
    }

    @action.bound onSearchInput(input: string) {
        this.searchInput = input
    }

    @action.bound onShowMore() {
        this.maxVisibleRows += 100
    }

    render() {
        const {
            postsToShowLimited,
            postsToShow,
            searchInput,
            numTotalRows,
            maxVisibleRows,
        } = this

        return (
            <AdminLayout title="Posts">
                <main className="PostsIndexPage">
                    <FieldsRow>
                        <span>
                            {searchInput
                                ? `Showing the first ${maxVisibleRows} of ${postsToShow.length} filtered posts out of a total of ${numTotalRows} posts`
                                : `Showing the first ${maxVisibleRows} of ${numTotalRows} posts`}
                        </span>
                        <SearchField
                            placeholder="Search all posts..."
                            value={searchInput}
                            onValue={this.onSearchInput}
                            autofocus
                        />
                    </FieldsRow>
                    <table className="table table-bordered">
                        <thead>
                            <tr>
                                <th>Title</th>
                                <th>Authors</th>
                                <th>Type</th>
                                <th>Status</th>
                                <th>Slug</th>
                                <th>Tags</th>
                                <th>Last Updated</th>
                                <th>WP vs Archie compare view</th>
                                <th>Gdoc</th>
                            </tr>
                        </thead>
                        <tbody>
                            {postsToShowLimited.map((post) => (
                                <PostRow
                                    key={post.id}
                                    post={post}
                                    availableTags={this.availableTags}
                                />
                            ))}
                        </tbody>
                    </table>
                    {postsToShow.length > maxVisibleRows && (
                        <button
                            className="btn btn-secondary"
                            onClick={this.onShowMore}
                        >
                            Show more posts...
                        </button>
                    )}
                </main>
            </AdminLayout>
        )
    }

    async getData() {
        const { admin } = this.context
        if (admin.currentRequests.length > 0) return

        const json = await admin.getJSON("/api/posts.json")
        runInAction(() => {
            this.posts = json.posts
        })
    }

    async getTags() {
        const json = await this.context.admin.getJSON("/api/tags.json")
        runInAction(() => (this.availableTags = json.tags))
    }

    componentDidMount() {
        void this.getData()
        void this.getTags()
    }
}
