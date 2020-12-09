import { FullPost } from "db/wpdb"
import React from "react"
import { formatAuthors, formatDate } from "site/server/formatting"

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
                <h3>{post.title}</h3>
                {post.subtitle && <h4>{post.subtitle}</h4>}
                <div className="entry-meta">
                    <time>{formatDate(post.date)}</time> by{" "}
                    {formatAuthors(post.authors)}
                </div>
            </a>
        </article>
    )
}

export default PostCard
