import { getCanonicalUrl } from "@ourworldindata/components"
import { OwidGdocType } from "@ourworldindata/types"
import React from "react"
import { useLinkedAuthor } from "../utils.js"

export const Byline = ({ names }: { names: string[] }) => {
    return (
        <>
            By:{" "}
            {names.map((name, idx) => (
                <React.Fragment key={name}>
                    <LinkedAuthor name={name} />
                    {idx === names.length - 1
                        ? ""
                        : idx === names.length - 2
                          ? " and "
                          : ", "}
                </React.Fragment>
            ))}
        </>
    )
}

const LinkedAuthor = ({ name }: { name: string }) => {
    const author = useLinkedAuthor(name)
    if (!author.slug) return <>{author.title}</>

    const path = getCanonicalUrl("", {
        slug: author.slug,
        content: { type: OwidGdocType.Author },
    })

    return <a href={path}>{author.title}</a>
}
