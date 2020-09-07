import * as React from "react"
import { observer } from "mobx-react"
import { observable, computed, action, runInAction } from "mobx"
import { format } from "timeago.js"
import fuzzysort from "fuzzysort"
import * as lodash from "lodash"

import { AdminLayout } from "./AdminLayout"
import { highlight as fuzzyHighlight } from "grapher/controls/FuzzySearch"
import { SearchField, FieldsRow } from "./Forms"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { WORDPRESS_URL } from "settings"
import { Tag } from "./TagBadge"

interface PostIndexMeta {
    id: number
    title: string
    type: string
    status: string
    publishedAt: string
    updatedAt: string
    excerpt: string
    slug: string
    url: string
    imageUrl: string
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

    render() {
        const { post } = this.props

        return (
            <tr>
                <td>
                    <img src={post.imageUrl} style={{ width: "120px" }} />
                </td>
                <td>
                    <h2>
                        <a href={post.url}>{post.title}</a>
                    </h2>
                    <p>{post.excerpt}</p>
                </td>
                <td>{post.type}</td>
                <td>{post.status}</td>
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
export class NewsletterPage extends React.Component {
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
                term: fuzzysort.prepare(post.title)
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
            <AdminLayout title="Newsletter">
                <main className="NewsletterPage">
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
                                <th></th>
                                <th>Summary</th>
                                <th>Type</th>
                                <th>Status</th>
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

        const json = await admin.getJSON("/api/newsletterPosts.json")
        runInAction(() => {
            this.posts = json.posts
        })
    }

    componentDidMount() {
        this.getData()
    }
}
