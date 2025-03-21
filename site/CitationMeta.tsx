import { Fragment } from "react"
import { dayjs } from "@ourworldindata/utils"

export const CitationMeta = (props: {
    // id: number
    title: string
    authors: string[]
    date: Date
    canonicalUrl: string
}) => {
    const { authors, title, date, canonicalUrl } = props
    return (
        <Fragment>
            <meta name="citation_title" content={title} />
            <meta name="citation_fulltext_html_url" content={canonicalUrl} />
            <meta name="citation_fulltext_world_readable" content="" />
            {/* <meta name="citation_volume" content="1"/>
        <meta name="citation_issue" content="1"/>
        <meta name="citation_firstpage" content={`e${id}`}/>
        <meta name="citation_online_date" content={dayjs(date).format("YYYY/MM/DD")}/> */}
            <meta
                name="citation_publication_date"
                content={dayjs(date).format("YYYY/MM/DD")}
            />
            <meta name="citation_journal_title" content="Our World in Data" />
            <meta name="citation_journal_abbrev" content="Our World in Data" />
            {authors.map((author) => (
                <meta key={author} name="citation_author" content={author} />
            ))}
        </Fragment>
    )
}
