import * as React from 'react'
import moment = require('moment')

export const CitationMeta = (props: { title: string, authors: string[], date: Date, canonicalUrl: string }) => {
    let {title, authors, date, canonicalUrl} = props

    if (authors.indexOf("Max Roser") === -1)
        authors = authors.concat(["Max Roser"])

    return <React.Fragment>
        <meta name="citation_title" content={title}/>
        {authors.map(author => <meta key={author} name="citation_author" content={author}/>)}
        <meta name="citation_publication_date" content={moment(date).format("YYYY/MM/DD")}/>
        <meta name="citation_journal_title" content="Our World in Data"/>
        <meta name="citation_fulltext_world_readable" content=""/>
        <meta name="citation_full_html_url" content={canonicalUrl} />		
    </React.Fragment>
}
