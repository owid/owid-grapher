import * as React from "react"
import * as lodash from "lodash"

import * as settings from "settings"
import { Head } from "./Head"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { FullPost } from "db/wpdb"
import PostCard from "site/client/PostCard/PostCard"

export const BlogIndexPage = (props: {
    posts: FullPost[]
    pageNum: number
    numPages: number
}) => {
    const { posts, pageNum, numPages } = props
    const pageNums = lodash.range(1, numPages + 1)
    const pageTitle = "Latest publications"

    return (
        <html>
            <Head
                canonicalUrl={
                    `${settings.BAKED_BASE_URL}/blog` +
                    (pageNum > 1 ? `/page/${pageNum}` : "")
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
                                    <PostCard post={post} />
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
