import * as React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, runInAction } from "mobx"
import { format } from "timeago.js"
import fuzzysort from "fuzzysort"
import * as lodash from "lodash"

import { highlight as fuzzyHighlight } from "charts/controls/FuzzySearch"
import { AdminLayout } from "./AdminLayout"
import { SearchField, FieldsRow, EditableTags } from "./Forms"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { WORDPRESS_URL } from "settings"
import { Tag } from "./TagBadge"

interface PostIndexMeta {
    id: number
    title: string
    type: string
    status: string
    authors: string[]
    updatedAt: string
    tags: Tag[]
}

interface Searchable {
    post: PostIndexMeta
    term?: Fuzzysort.Prepared
}

@observer
class PostRow extends React.Component<{
    post: PostIndexMeta
    highlight: (text: string) => any
    availableTags: Tag[]
}> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    async saveTags(tags: Tag[]) {
        const { post } = this.props
        const json = await this.context.admin.requestJSON(
            `/api/posts/${post.id}/setTags`,
            { tagIds: tags.map(t => t.id) },
            "POST"
        )
        if (json.success) {
            runInAction(() => (post.tags = tags))
        }
    }

    @action.bound onSaveTags(tags: Tag[]) {
        this.saveTags(tags)
    }

    render() {
        const { post, highlight, availableTags } = this.props

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
                <td>{format(post.updatedAt)}</td>
                <td>
                    <a
                        href={`${WORDPRESS_URL}/wp/wp-admin/post.php?post=${post.id}&action=edit`}
                        className="btn btn-primary"
                    >
                        Edit
                    </a>
                </td>
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
                )
            })
        }

        return searchIndex
    }

    @computed get postsToShow(): PostIndexMeta[] {
        const { searchInput, searchIndex, maxVisibleRows } = this
        if (searchInput) {
            const results = fuzzysort.go(searchInput, searchIndex, {
                limit: 50,
                key: "term"
            })
            return lodash.uniq(results.map((result: any) => result.obj.post))
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
                            </tr>
                        </thead>
                        <tbody>
                            {postsToShow.map(post => (
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
