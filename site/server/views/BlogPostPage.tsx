import * as React from "react"
import { BAKED_BASE_URL, WORDPRESS_URL } from "settings"

import {
    formatAuthors,
    formatDate,
    FormattedPost,
    FormattingOptions
} from "../formatting"

import { Head } from "./Head"
import { SiteFooter } from "./SiteFooter"
import { SiteHeader } from "./SiteHeader"

export const BlogPostPage = (props: {
    post: FormattedPost
    formattingOptions: FormattingOptions
}) => {
    const { post, formattingOptions } = props

    const pageTitle = post.title
    const canonicalUrl = `${BAKED_BASE_URL}/${post.path}`
    const pageDesc = post.excerpt

    return (
        <html>
            <Head
                pageTitle={pageTitle}
                pageDesc={pageDesc}
                canonicalUrl={canonicalUrl}
                imageUrl={post.imageUrl}
            />
            <body
                className={`single-post ${formattingOptions.bodyClassName ||
                    ""}`}
            >
                <SiteHeader />
                <main>
                    <div className="site-content">
                        <article className="post">
                            <header className="article-header">
                                <h1 className="entry-title">{post.title}</h1>
                                <div className="entry-meta">
                                    <time>{formatDate(post.date)}</time>{" "}
                                    {!formattingOptions.hideAuthors &&
                                        `by ${formatAuthors(post.authors)}`}
                                </div>
                            </header>
                            {post.info && (
                                <div
                                    className="blog-info"
                                    dangerouslySetInnerHTML={{
                                        __html: post.info
                                    }}
                                />
                            )}
                            <div
                                className="article-content"
                                dangerouslySetInnerHTML={{ __html: post.html }}
                            />
                            {post.footnotes.length > 0 && (
                                <footer className="article-footer">
                                    <h2 id="footnotes">Footnotes</h2>
                                    <ol className="footnotes">
                                        {post.footnotes.map((footnote, i) => (
                                            <li key={i} id={`note-${i + 1}`}>
                                                <p
                                                    dangerouslySetInnerHTML={{
                                                        __html: footnote
                                                    }}
                                                />
                                            </li>
                                        ))}
                                    </ol>
                                </footer>
                            )}
                        </article>
                    </div>
                </main>
                <div id="wpadminbar" style={{ display: "none" }}>
                    <div
                        className="quicklinks"
                        id="wp-toolbar"
                        role="navigation"
                        aria-label="Toolbar"
                    >
                        <ul
                            id="wp-admin-bar-root-default"
                            className="ab-top-menu"
                        >
                            <li id="wp-admin-bar-site-name" className="menupop">
                                <a
                                    className="ab-item"
                                    aria-haspopup="true"
                                    href="/wp/wp-admin/"
                                >
                                    Our World In Data
                                </a>
                            </li>
                            <li id="wp-admin-bar-edit">
                                <a
                                    className="ab-item"
                                    href={`${WORDPRESS_URL}/wp/wp-admin/post.php?post=${post.postId ||
                                        post.id}&action=edit`}
                                >
                                    Edit Post
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
                <SiteFooter hideDonate={formattingOptions.hideDonateFooter} />
            </body>
        </html>
    )
}
