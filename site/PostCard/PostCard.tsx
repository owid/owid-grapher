import React from "react"
import { FullPost } from "../../clientUtils/owidTypes"
import { formatAuthors, formatDate } from "../formatting"

const PostCard = ({ post }: { post: FullPost }) => {
    return (
        <article className="post-card">
            <a href={`/${post.path}`}>
                {post.imageUrl && (
                    <div
                        className="cover-image"
                        style={{
                            backgroundImage: `url(${post.imageUrl})`,
                        }}
                    />
                )}
                <div className="content">
                    <div>
                        <h3>{post.title}</h3>
                        {post.excerpt && (
                            <div className="excerpt">{post.excerpt}</div>
                        )}
                    </div>
                    <div className="entry-meta">
                        <span className="authors">{`By ${formatAuthors(
                            post.authors
                        )}`}</span>{" "}
                        &mdash; <time>{formatDate(post.date)}</time>
                    </div>
                </div>
            </a>
        </article>
    )
}

export default PostCard
