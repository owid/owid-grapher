import { getCanonicalUrl } from "@ourworldindata/components"
import { DbEnrichedAuthor, OwidGdocType } from "@ourworldindata/types"
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
    if (!author.slug) return <>{author.title}</>

    const path = getCanonicalUrl("", {
        slug: author.slug,
        content: { type: OwidGdocType.Author },
    })

    return <a href={path}>{author.title}</a>
}
