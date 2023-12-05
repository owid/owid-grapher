import React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, runInAction } from "mobx"

import {
    ChartTagJoin,
    Tag,
    buildSearchWordsFromSearchString,
    filterFunctionForSearchWords,
    SearchWord,
} from "@ourworldindata/utils"
import { AdminLayout } from "./AdminLayout.js"
import { SearchField, FieldsRow, Timeago } from "./Forms.js"
import { EditableTags } from "./EditableTags.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { ADMIN_BASE_URL, WORDPRESS_URL } from "../settings/clientSettings.js"
import { match } from "ts-pattern"

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import {
    faEye,
    faChainBroken,
    faRecycle,
} from "@fortawesome/free-solid-svg-icons"

interface PostIndexMeta {
    id: number
    title: string
    type: string
    status: string
    authors: string[]
    slug: string
    updatedAtInWordpress: string
    tags: ChartTagJoin[]
    gdocSuccessorId: string | undefined
}

enum GdocStatus {
    "MISSING" = "MISSING",
    "CONVERTING" = "CONVERTING",
    "CONVERTED" = "CONVERTED",
}

interface PostRowProps {
    post: PostIndexMeta
    availableTags: Tag[]
}

@observer
class PostRow extends React.Component<PostRowProps> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable private postGdocStatus: GdocStatus = GdocStatus.MISSING

    constructor(props: PostRowProps) {
        super(props)
        this.postGdocStatus = props.post.gdocSuccessorId
            ? GdocStatus.CONVERTED
            : GdocStatus.MISSING
    }

    async saveTags(tags: ChartTagJoin[]) {
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

    @action.bound onSaveTags(tags: ChartTagJoin[]) {
        this.saveTags(tags)
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
            this.onConvertGdoc(true)
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
            this.postGdocStatus = GdocStatus.MISSING
            this.props.post.gdocSuccessorId = undefined
        }
    }

    render() {
        const { post, availableTags } = this.props
        const { postGdocStatus } = this
        const gdocElement = match(postGdocStatus)
            .with(GdocStatus.MISSING, () => (
                <button
                    onClick={async () => await this.onConvertGdoc()}
                    className="btn btn-primary"
                >
                    Create GDoc
                </button>
            ))
            .with(GdocStatus.CONVERTING, () => <span>Converting...</span>)
            .with(GdocStatus.CONVERTED, () => (
                <>
                    <a
                        href={`${ADMIN_BASE_URL}/admin/gdocs/${post.gdocSuccessorId}/preview`}
                        className="btn btn-primary"
                    >
                        <>
                            <FontAwesomeIcon icon={faEye} /> Preview
                        </>
                    </a>
                    <button
                        onClick={this.onRecreateGdoc}
                        className="btn btn-primary alert-danger"
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
                        className="btn btn-primary alert-danger"
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
                <td>{post.authors.join(", ")}</td>
                <td>{post.type}</td>
                <td>{post.status}</td>
                <td>{post.slug}</td>
                <td style={{ minWidth: "380px" }}>
                    <EditableTags
                        tags={post.tags}
                        suggestions={availableTags}
                        onSave={this.onSaveTags}
                    />
                </td>
                <td>
                    <Timeago time={post.updatedAtInWordpress} />
                </td>
                <td>
                    <a
                        href={`${WORDPRESS_URL}/wp/wp-admin/post.php?post=${post.id}&action=edit`}
                        className="btn btn-primary"
                    >
                        Edit
                    </a>
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
    @observable availableTags: Tag[] = []

    @computed get searchWords(): SearchWord[] {
        const { searchInput } = this
        return buildSearchWordsFromSearchString(searchInput)
    }

    @computed get postsToShow(): PostIndexMeta[] {
        const { searchWords, maxVisibleRows, posts } = this
        if (searchWords.length > 0) {
            const filterFn = filterFunctionForSearchWords(
                searchWords,
                (post: PostIndexMeta) => [
                    post.title,
                    post.slug,
                    `${post.id}`,
                    post.authors.join(" "),
                ]
            )
            return posts.filter(filterFn).slice(0, maxVisibleRows)
        } else {
            return posts.slice(0, maxVisibleRows)
        }
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
        const { postsToShow, searchInput, numTotalRows } = this

        return (
            <AdminLayout title="Posts">
                <main className="PostsIndexPage">
                    <FieldsRow>
                        <span>
                            Showing {postsToShow.length} of {numTotalRows} posts
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
                                <th></th>
                                <th>WP vs Archie compare view</th>
                                <th>Gdoc</th>
                            </tr>
                        </thead>
                        <tbody>
                            {postsToShow.map((post) => (
                                <PostRow
                                    key={post.id}
                                    post={post}
                                    availableTags={this.availableTags}
                                />
                            ))}
                        </tbody>
                    </table>
                    {!searchInput && (
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
        this.getData()
        this.getTags()
    }
}
