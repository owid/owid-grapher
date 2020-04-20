import React from "react"
import moment from "moment"
import _ from "lodash"

import { Post } from "db/model/Post"
import { Head } from "./Head"
import { BAKED_BASE_URL } from "settings"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import { TableOfContents } from "site/client/TableOfContents"

type Entry = Pick<Post.Row, "title" | "slug" | "published_at">

export const EntriesByYearPage = (props: { entries: Entry[] }) => {
    const entriesByYear = _.groupBy(props.entries, e =>
        moment(e.published_at as Date).year()
    )

    const years = Object.keys(entriesByYear)
        .sort()
        .reverse()

    const pageTitle = "Entries by Year"
    const tocEntries = years.map(year => {
        return {
            isSubheading: false,
            slug: year,
            text: year
        }
    })

    return (
        <html>
            <Head
                canonicalUrl={`${BAKED_BASE_URL}/entries-by-year`}
                pageTitle="Entries by Year"
                pageDesc="An index of Our World in Data entries by year of first publication."
            />
            <body className="EntriesByYearPage">
                <SiteHeader />
                <main>
                    <div className="page with-sidebar">
                        <div className="content-wrapper">
                            <div>
                                <TableOfContents
                                    headings={tocEntries}
                                    pageTitle={pageTitle}
                                />
                            </div>
                            <div className="offset-content">
                                <div className="content">
                                    <p>
                                        Entries by year of first publication.
                                        Note that older entries are often
                                        updated with new content.
                                    </p>
                                    {years.map(year => (
                                        <section key={year}>
                                            <h2 id={year}>
                                                <a
                                                    href={`${BAKED_BASE_URL}/entries-by-year/${year}`}
                                                >
                                                    {year}
                                                </a>
                                            </h2>
                                            <ul>
                                                {entriesByYear[year].map(
                                                    entry => (
                                                        <li key={entry.slug}>
                                                            <a
                                                                href={`${BAKED_BASE_URL}/${entry.slug}`}
                                                            >
                                                                {entry.title}
                                                            </a>
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        </section>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
                <SiteFooter hideDonate={true} />

                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                        runTableOfContents(${JSON.stringify({
                            headings: tocEntries,
                            pageTitle
                        })})`
                    }}
                />
            </body>
        </html>
    )
}

export const EntriesForYearPage = (props: {
    entries: Entry[]
    year: number
}) => {
    const entriesByYear = _.groupBy(props.entries, e =>
        moment(e.published_at as Date).year()
    )

    const years = Object.keys(entriesByYear)
        .sort()
        .reverse()
        .filter(y => parseInt(y) === props.year)

    return (
        <html>
            <Head
                canonicalUrl={`${BAKED_BASE_URL}/entries-by-year/${props.year}`}
                pageTitle={`${props.year} Entries`}
                pageDesc={`Our World in Data entries first published in ${props.year}.`}
            />
            <body className="EntriesByYearPage">
                <SiteHeader />
                <main>
                    <div className="page">
                        <div className="content-wrapper">
                            <div className="offset-content">
                                <div className="content">
                                    {years.map(year => (
                                        <section>
                                            <h2>{year}</h2>
                                            <ul>
                                                {entriesByYear[year].map(
                                                    entry => (
                                                        <li key={entry.slug}>
                                                            <a
                                                                href={`${BAKED_BASE_URL}/${entry.slug}`}
                                                            >
                                                                {entry.title}
                                                            </a>
                                                        </li>
                                                    )
                                                )}
                                            </ul>
                                        </section>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
                <SiteFooter hideDonate={true} />
            </body>
        </html>
    )
}
