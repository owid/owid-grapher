import { Component } from "react"
import { observer } from "mobx-react"
import { observable, runInAction } from "mobx"

import { LoadingBlocker, BindString } from "./Forms.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"

interface Post {
    id: number
    title: string
    slug: string
    publishedAt?: string
    updatedAt: string
    content: string
}

class PostEditor extends Component<{ post: Post }> {
    render() {
        const { post } = this.props
        return (
            <div className="PostEditor">
                <BindString store={post} field="title" />
                <BindString store={post} field="slug" />
                <BindString store={post} field="content" textarea />
            </div>
        )
    }
}

@observer
export class PostEditorPage extends Component<{ postId?: number }> {
    static contextType = AdminAppContext
    context!: AdminAppContextType

    @observable.ref post?: Post

    async fetchPost() {
        const { postId } = this.props
        const { admin } = this.context
        const json = await admin.getJSON(`/api/posts/${postId}.json`)
        runInAction(() => (this.post = json as Post))
    }

    componentDidMount() {
        void this.fetchPost()
    }

    render() {
        return (
            <AdminLayout>
                <main className="PostEditorPage">
                    {this.post ? (
                        <PostEditor post={this.post} />
                    ) : (
                        <LoadingBlocker />
                    )}
                </main>
            </AdminLayout>
        )
    }
}
