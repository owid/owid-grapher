import React from "react"
import { observer } from "mobx-react"
import { observable, runInAction, makeObservable } from "mobx"

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

export const PostEditorPage = observer(
    class PostEditorPage extends React.Component<{ postId?: number }> {
        static contextType = AdminAppContext
        context!: AdminAppContextType

        post?: Post

        constructor(props: { postId?: number }) {
            super(props)

            makeObservable(this, {
                post: observable.ref,
            })
        }

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
)
