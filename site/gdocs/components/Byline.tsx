import { DbEnrichedAuthor } from "@ourworldindata/types"
import React from "react"

export const Byline = ({ authors }: { authors: DbEnrichedAuthor[] }) => {
    return (
        <>
            By:{" "}
            {authors.map((author, idx) => (
                <>
                    <LinkedAuthor key={author.title} author={author} />
                    {idx === authors.length - 1
                        ? ""
                        : idx === authors.length - 2
                          ? " and "
                          : ", "}
                </>
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
