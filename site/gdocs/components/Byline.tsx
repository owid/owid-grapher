import { DbEnrichedAuthor } from "@ourworldindata/types"
import React from "react"
import { useLinkedDocument } from "../utils.js"

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
    const gdocUrl = `https://docs.google.com/document/d/${author.id}`
    const { linkedDocument } = useLinkedDocument(gdocUrl)

    if (linkedDocument && linkedDocument.published && linkedDocument.slug) {
        return <a href={`/${linkedDocument.slug}`}>{author.title}</a>
    }
    return <>{author.title}</>
}
