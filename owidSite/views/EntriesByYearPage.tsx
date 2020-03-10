import React = require("react")

import { Post } from "db/model/Post"
import { Head } from "./Head"
import { BAKED_BASE_URL } from "settings"
import { SiteHeader } from "./SiteHeader"
import { SiteFooter } from "./SiteFooter"
import moment = require("moment")
import _ = require("lodash")

type Entry = Pick<Post.Row, "title" | "slug" | "published_at">

export const EntriesByYearPage = (props: { entries: Entry[] }) => {
    const entriesByYear = _.groupBy(props.entries, e =>
        moment(e.published_at as Date).year()
    )

    const years = Object.keys(entriesByYear)
        .sort()
        .reverse()

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
                    <p>
                        Entries by year of first publication. Note that older
                        entries are often updated with new content.
                    </p>
                    {years.map(year => (
                        <section>
                            <h2>
                                <a
                                    href={`${BAKED_BASE_URL}/entries-by-year/${year}`}
                                >
                                    {year}
                                </a>
                            </h2>
                            <ul>
                                {entriesByYear[year].map(entry => (
                                    <li key={entry.slug}>
                                        <a
                                            href={`${BAKED_BASE_URL}/${entry.slug}`}
                                        >
                                            {entry.title}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </main>
                <SiteFooter hideDonate={true} />
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
                    {years.map(year => (
                        <section>
                            <h2>{year}</h2>
                            <ul>
                                {entriesByYear[year].map(entry => (
                                    <li key={entry.slug}>
                                        <a
                                            href={`${BAKED_BASE_URL}/${entry.slug}`}
                                        >
                                            {entry.title}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    ))}
                </main>
                <SiteFooter hideDonate={true} />
            </body>
        </html>
    )
}
