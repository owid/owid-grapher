import * as settings from '../settings'
import * as React from 'react'
import { Head } from './Head'
import { SiteHeader } from './SiteHeader'
import { SiteFooter } from './SiteFooter'
import { CategoryWithEntries } from '../wpdb'
import { formatAuthors, formatDate } from '../formatting'
import * as _ from 'lodash'

interface PostMeta {
    title: string
    slug: string
    date: Date
    authors: string[]
    imageUrl?: string
}

export const BlogIndexPage = (props: { posts: PostMeta[], pageNum: number, numPages: number }) => {
    const {posts, pageNum, numPages} = props
    const pageNums = _.range(1, numPages+1)

    return <html>
        <Head canonicalUrl={`${settings.BAKED_URL}/blog` + (pageNum > 1 ? `/page/${pageNum}` : "")} pageTitle="Blog"/>
        <body className="blog">
            <SiteHeader/>

            <main>
                <div className="site-content">
                    <h2>Latest Posts</h2>
                    <ul className="posts">
                        {posts.map(post => 
                            <li key={post.slug} className="post">
                                <a href={`/${post.slug}`}>
                                    {post.imageUrl && <img src={post.imageUrl}/>}
                                    <h3>{post.title}</h3>
                                    <div className="entry-meta">
                                        <time>{formatDate(post.date)}</time> by {formatAuthors(post.authors)}
                                    </div>
                                </a>
                            </li>
                        )}
                	</ul>
                    <nav className="navigation pagination" role="navigation">
                        <h2 className="screen-reader-text">Posts navigation</h2>
                        <div className="nav-link">
                            {pageNums.map(num => 
                                <a key={num} className={"page-numbers" + (num === pageNum ? " current" : "")} href={num === 1 ? '/blog/' : `/blog/page/${num}`}>{num}</a>
                            )}
                        </div>
                    </nav>
                </div>
            </main>
            <SiteFooter/>
        </body>        
    </html>
}