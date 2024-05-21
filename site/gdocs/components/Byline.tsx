import { DbEnrichedAuthor } from "@ourworldindata/types"
import React from "react"

export const Byline = ({ authors }: { authors: DbEnrichedAuthor[] }) => {
    return (
        <>
            By:{" "}
            {authors.map((author) => (
                <LinkedAuthor key={author.title} author={author} />
            ))}
        </>
    )
}

const LinkedAuthor = ({ author }: { author: DbEnrichedAuthor }) => {
    if (author.slug) {
        return <a href={`/${author.slug}`}>{author.title}</a>
    }
    return <>{author.title}</>
}
