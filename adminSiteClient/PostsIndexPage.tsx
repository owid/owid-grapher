import React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, runInAction } from "mobx"
import fuzzysort from "fuzzysort"
import * as lodash from "lodash"

import { highlight as fuzzyHighlight } from "@ourworldindata/grapher"
import { AdminLayout } from "./AdminLayout.js"
import { SearchField, FieldsRow, EditableTags, Timeago } from "./Forms.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { WORDPRESS_URL } from "../settings/clientSettings.js"
import { Tag } from "./TagBadge.js"
import { match } from "ts-pattern"

interface PostIndexMeta {
    id: number
    title: string
    type: string
    status: string
    authors: string[]
    updatedAt: string
    tags: Tag[]
    gdocSuccessorId: string | undefined
}

interface Searchable {
    post: PostIndexMeta
    term?: Fuzzysort.Prepared
}

enum GdocStatus {
    "MISSING" = "MISSING",
    "CONVERTING" = "CONVERTING",
    "CONVERTED" = "CONVERTED",
}

interface PostRowProps {
    post: PostIndexMeta
    highlight: (text: string) => string | JSX.Element
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

    async saveTags(tags: Tag[]) {
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

    @action.bound onSaveTags(tags: Tag[]) {
        this.saveTags(tags)
    }

    @action.bound async onConvertGdoc() {
        this.postGdocStatus = GdocStatus.CONVERTING
        const { admin } = this.context
        const json = await admin.requestJSON(
            `/api/posts/${this.props.post.id}/createGdoc`,
            {},
            "POST"
        )
        this.postGdocStatus = GdocStatus.CONVERTED
        this.props.post.gdocSuccessorId = json.gdocId
    }

    render() {
        const { post, highlight, availableTags } = this.props
        const { postGdocStatus } = this
        const gdocElement = match(postGdocStatus)
            .with(GdocStatus.MISSING, () => (
                <button onClick={this.onConvertGdoc}>Create GDoc</button>
            ))
            .with(GdocStatus.CONVERTING, () => <span>Converting...</span>)
            .with(GdocStatus.CONVERTED, () => (
                <a
                    href={`https://docs.google.com/document/d/${post.gdocSuccessorId}/edit`}
                    target="_blank"
                    rel="noopener"
                >
                    View GDoc
                </a>
            ))
            .exhaustive()

        return (
            <tr>
                <td>{highlight(post.title) || "(no title)"}</td>
                <td>{highlight(post.authors.join(", "))}</td>
                <td>{post.type}</td>
                <td>{post.status}</td>
                <td style={{ minWidth: "380px" }}>
                    <EditableTags
                        tags={post.tags}
                        suggestions={availableTags}
                        onSave={this.onSaveTags}
                    />
                </td>
                <td>
                    <Timeago time={post.updatedAt} />
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

    @computed get searchIndex(): Searchable[] {
        const searchIndex: Searchable[] = []
        for (const post of this.posts) {
            searchIndex.push({
                post: post,
                term: fuzzysort.prepare(
                    post.title + " " + post.authors.join(", ")
                ),
            })
        }

        return searchIndex
    }

    @computed get postsToShow(): PostIndexMeta[] {
        const { searchInput, searchIndex, maxVisibleRows } = this
        if (searchInput) {
            const results = fuzzysort.go(searchInput, searchIndex, {
                limit: 50,
                key: "term",
            })
            return lodash.uniq(results.map((result) => result.obj.post))
        } else {
            return this.posts.slice(0, maxVisibleRows)
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

        const highlight = (text: string) => {
            if (this.searchInput) {
                const html =
                    fuzzyHighlight(fuzzysort.single(this.searchInput, text)) ??
                    text
                return <span dangerouslySetInnerHTML={{ __html: html }} />
            } else return text
        }

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
                                    highlight={highlight}
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
