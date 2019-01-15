import {BAKED_URL, WORDPRESS_URL} from '../settings'
import * as React from 'react'
import { Head } from './Head'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { formatAuthors, formatDate, FormattedPost, FormattingOptions } from '../formatting'

export const BlogPostPage = (props: { post: FormattedPost, formattingOptions: FormattingOptions }) => {
    const {post, formattingOptions} = props

    const pageTitle = post.title
    const canonicalUrl = `${BAKED_URL}/${post.slug}`
    const pageDesc = post.excerpt

    return <html>
        <Head pageTitle={pageTitle} pageDesc={pageDesc} canonicalUrl={canonicalUrl} imageUrl={post.imageUrl}/>
        <body className={`single-post ${formattingOptions.bodyClassName || ""}`}>
            <SiteHeader/>
            <main>
                <header className="blog-header">
                    <h1>
                        <a href="/blog">Blog</a>
                    </h1>
                </header>
                <div className="site-content">
                    <article className="post">
                        <header className="articleHeader">
                            <h1 className="entry-title">{post.title}</h1>
                            <div className="entry-meta">
                                <time>{formatDate(post.date)}</time> by {formatAuthors(post.authors)}
                            </div>
                        </header>
                        <div className="article-content" dangerouslySetInnerHTML={{__html: post.html}}/>
                        {post.footnotes.length > 0 && <footer className="article-footer">
                            <h2 id="footnotes">Footnotes</h2>
                            <ol className="footnotes">
                                {post.footnotes.map((footnote, i) =>
                                    <li id={`note-${i+1}`}>
                                        <p dangerouslySetInnerHTML={{__html: footnote}}/>
                                    </li>
                                )}
                            </ol>
                        </footer>}
                    </article>
                </div>
            </main>
            <div id="wpadminbar" style={{display: 'none'}}>
                <div className="quicklinks" id="wp-toolbar" role="navigation" aria-label="Toolbar">
                    <ul id="wp-admin-bar-root-default" className="ab-top-menu">
                        <li id="wp-admin-bar-site-name" className="menupop">
                            <a className="ab-item" aria-haspopup="true" href="/wp-admin/">Our World In Data</a>
                        </li>
                        <li id="wp-admin-bar-edit"><a className="ab-item" href={`${WORDPRESS_URL}/wp-admin/post.php?post=${post.id}&action=edit`}>Edit Post</a></li>
                    </ul>
                </div>
            </div>
            <SiteFooter/>
        </body>
    </html>
}
