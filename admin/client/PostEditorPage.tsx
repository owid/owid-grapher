import { observable, runInAction } from "mobx"
import { observer } from "mobx-react"
import * as React from "react"

import { AdminAppContext, AdminAppContextType } from "./AdminAppContext"
import { AdminLayout } from "./AdminLayout"
import { BindString, LoadingBlocker } from "./Forms"

interface Post {
    id: number
    title: string
    slug: string
    publishedAt?: string
    updatedAt: string
    content: string
}

class PostEditor extends React.Component<{ post: Post }> {
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
export class PostEditorPage extends React.Component<{ postId?: number }> {
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
        this.fetchPost()
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
