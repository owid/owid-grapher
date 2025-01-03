import { IndexPost, formatDate } from "@ourworldindata/utils"
import { formatUrls } from "../formatting.js"
import { formatAuthors } from "../clientFormatting.js"

const PostCard = ({
    post,
    hideDate = false,
}: {
    post: IndexPost
    hideDate?: boolean
}) => {
    return (
        <article className="post-card">
            <a href={`/${post.slug}`}>
                {post.imageUrl && (
                    <div
                        className="cover-image"
                        style={{
                            backgroundImage: `url(${encodeURI(
                                formatUrls(post.imageUrl)
                            )})`,
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
                        <span className="authors">{`By ${formatAuthors({
                            authors: post.authors,
                        })}`}</span>{" "}
                        {hideDate ? null : (
                            <>
                                &mdash; <time>{formatDate(post.date)}</time>
                            </>
                        )}
                    </div>
                </div>
            </a>
        </article>
    )
}

export default PostCard
