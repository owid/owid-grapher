import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction, reaction, IReactionDisposer} from 'mobx'
const timeago = require('timeago.js')()
const fuzzysort = require("fuzzysort")
import * as _ from 'lodash'

import Admin from './Admin'
import AdminLayout from './AdminLayout'
import { SearchField, FieldsRow } from './Forms'

interface PostIndexMeta {
    id: number
    title: string
    type: string
    status: string
    authors: string[]
    updatedAt: string
}

interface Searchable {
    post: PostIndexMeta
    term: string
}

@observer
class PostRow extends React.Component<{ post: PostIndexMeta, highlight: (text: string) => any }> {
    context!: { admin: Admin }

    render() {
        const {post, highlight} = this.props
        const {admin} = this.context

        return <tr>
            <td>{highlight(post.title) || "(no title)"}</td>
            <td>{highlight(post.authors.join(", "))}</td>
            <td>{post.type}</td>
            <td>{post.status}</td>
            <td>{timeago.format(post.updatedAt)}</td>
            <td>
                <a href={`/wp-admin/post.php?post=${post.id}&action=edit`} className="btn btn-primary">Edit</a>
            </td>
            {/*<td>
                <button className="btn btn-danger" onClick={_ => this.props.onDelete(chart)}>Delete</button>
            </td>*/}
        </tr>
    }
}

@observer
export default class PostsIndexPage extends React.Component {
    context!: { admin: Admin }

    @observable posts: PostIndexMeta[] = []
    @observable maxVisibleRows = 50
    @observable searchInput?: string

    @computed get searchIndex(): Searchable[] {
        const searchIndex: Searchable[] = []
        for (const post of this.posts) {
            searchIndex.push({
                post: post,
                term: fuzzysort.prepare(post.title + " " + post.authors.join(", "))
            })
        }

        return searchIndex
    }

    @computed get postsToShow(): PostIndexMeta[] {
        const {searchInput, searchIndex, maxVisibleRows} = this
        if (searchInput) {
            const results = fuzzysort.go(searchInput, searchIndex, {
                limit: 50,
                key: 'term'
            })
            console.log(results)
            return _.uniq(results.map((result: any) => result.obj.post))
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
        const {postsToShow, searchInput, numTotalRows} = this

        const highlight = (text: string) => {
            if (this.searchInput) {
                const html = fuzzysort.highlight(fuzzysort.single(this.searchInput, text)) || text
                return <span dangerouslySetInnerHTML={{__html: html}}/>
            } else
                return text
        }

        return <AdminLayout title="posts">
            <main className="PostsIndexPage">
                <FieldsRow>
                    <span>Showing {postsToShow.length} of {numTotalRows} pages</span>
                    <SearchField placeholder="Search all pages..." value={searchInput} onValue={this.onSearchInput} autofocus/>
                </FieldsRow>
                <table className="table table-bordered">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Authors</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Last Updated</th>
                            <th></th>
                        </tr>
                    </thead>
                        <tbody>
                        {postsToShow.map(post => <PostRow post={post} highlight={highlight}/>)}
                    </tbody>
                </table>
                {!searchInput && <button className="btn btn-secondary" onClick={this.onShowMore}>Show more pages...</button>}
            </main>
        </AdminLayout>
    }

    async getData() {
        const {admin} = this.context
        if (admin.currentRequests.length > 0)
            return

        const json = await admin.getJSON("/api/posts.json")
        runInAction(() => {
            this.posts = json.posts
        })
    }

    componentDidMount() {
        this.getData()
     }
}