import React from "react"
import { Head } from "./Head.js"
import { SiteHeader } from "./SiteHeader.js"
import { SiteFooter } from "./SiteFooter.js"
import { range, IndexPost } from "@ourworldindata/utils"
import PostCard from "./PostCard/PostCard.js"

export const BlogIndexPage = (props: {
    posts: IndexPost[]
    pageNum: number
    numPages: number
    baseUrl: string
}) => {
    const { posts, pageNum, numPages, baseUrl } = props
    const pageNums = range(1, numPages + 1)
    const pageTitle = "Our latest work"

    return (
        <html>
            <Head
                canonicalUrl={
                    `${baseUrl}/blog` + (pageNum > 1 ? `/page/${pageNum}` : "")
                }
                pageTitle={pageTitle}
                baseUrl={baseUrl}
            />
            <body className="blog">
                <SiteHeader baseUrl={baseUrl} />

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
                <SiteFooter baseUrl={baseUrl} />
            </body>
        </html>
    )
}
