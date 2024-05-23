import { getCanonicalUrl } from "@ourworldindata/components"
import { OwidGdocType } from "@ourworldindata/types"
import React from "react"
import { useLinkedAuthor } from "../utils.js"

export const Byline = ({ names }: { names: string[] }) => {
    return (
        <>
            {"By: "}
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
    // Somehow, using a fragment here messes up the hydration process and causes
    // some links to be applied to the wrong authors, but only if the first
    // author is unlinked (which probably gets tangled with the "By: " text
    // above). Additional markup, here in the form of a span, works more
    // reliably.
    if (!author.slug) return <span>{author.title}</span>

    const path = getCanonicalUrl("", {
        slug: author.slug,
        content: { type: OwidGdocType.Author },
    })

    return <a href={path}>{author.title}</a>
}
