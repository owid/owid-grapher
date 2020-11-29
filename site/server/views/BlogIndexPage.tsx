import * as React from "react"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { formatAuthors, formatDate } from "site/server/formatting"
import { FullPost } from "db/wpdb"
import { range } from "clientUtils/Util"

export const BlogIndexPage = (props: {
    posts: FullPost[]
    pageNum: number
    numPages: number
    baseUrl: string
}) => {
    const { posts, pageNum, numPages, baseUrl } = props
    const pageNums = range(1, numPages + 1)
    const pageTitle = "Latest publications"

    return (
        <html>
            <Head
                canonicalUrl={
                    `${baseUrl}/blog` + (pageNum > 1 ? `/page/${pageNum}` : "")
                }
                pageTitle={pageTitle}
            />
            <body className="blog">
                <SiteHeader />

                <main className="wrapper">
                    <div className="site-content">
                        <h2>{pageTitle}</h2>
                        <ul className="posts">
                            {posts.map((post) => (
                                <li key={post.slug} className="post">
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
                                        <div className="entry-meta">
                                            <time>{formatDate(post.date)}</time>{" "}
                                            by {formatAuthors(post.authors)}
                                        </div>
                                    </a>
                                </li>
                            ))}
                        </ul>
                        <nav
                            className="navigation pagination"
                            role="navigation"
                        >
                            <h2 className="screen-reader-text">
                                Posts navigation
                            </h2>
                            <div className="nav-link">
                                {pageNums.map((num) => (
                                    <a
                                        key={num}
                                        className={
                                            "page-numbers" +
                                            (num === pageNum ? " current" : "")
                                        }
                                        href={
                                            num === 1
                                                ? "/blog/"
                                                : `/blog/page/${num}`
                                        }
                                    >
                                        {num}
                                    </a>
                                ))}
                            </div>
                        </nav>
                    </div>
                </main>
                <SiteFooter />
            </body>
        </html>
    )
}
