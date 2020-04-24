import * as React from "react"
import moment from "moment"

export const CitationMeta = (props: {
    id: number
    title: string
    authors: string[]
    date: Date
    canonicalUrl: string
}) => {
    const { title, date, canonicalUrl } = props
    let { authors } = props

    if (authors.indexOf("Max Roser") === -1)
        authors = authors.concat(["Max Roser"])

    return (
        <React.Fragment>
            <meta name="citation_title" content={title} />
            <meta name="citation_fulltext_html_url" content={canonicalUrl} />
            <meta name="citation_fulltext_world_readable" content="" />
            {/* <meta name="citation_volume" content="1"/>
        <meta name="citation_issue" content="1"/>
        <meta name="citation_firstpage" content={`e${id}`}/>
        <meta name="citation_online_date" content={moment(date).format("YYYY/MM/DD")}/> */}
            <meta
                name="citation_publication_date"
                content={moment(date).format("YYYY/MM/DD")}
            />
            <meta name="citation_journal_title" content="Our World in Data" />
            <meta name="citation_journal_abbrev" content="Our World in Data" />
            {authors.map(author => (
                <meta key={author} name="citation_author" content={author} />
            ))}
        </React.Fragment>
    )
}
