import React from "react"
import { LinkedAuthor, OwidGdocType } from "@ourworldindata/types"
import { getCanonicalUrl } from "@ourworldindata/components"

/** Renders author names, linking to their author page when available */
export function SlideshowAuthorByline(props: {
    authors?: string
    linkedAuthors?: LinkedAuthor[]
}): React.ReactElement {
    const { authors, linkedAuthors } = props

    if (!authors) {
        return <>Our World in Data</>
    }

    const names = authors
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean)

    return (
        <>
            {names.map((name, i) => {
                const linked = linkedAuthors?.find((a) => a.name === name)
                const isLast = i === names.length - 1
                const isSecondToLast = i === names.length - 2
                return (
                    <React.Fragment key={name}>
                        {linked ? (
                            <a
                                className="SlideshowPresentation__author-link"
                                href={getCanonicalUrl("", {
                                    slug: linked.slug,
                                    content: {
                                        type: OwidGdocType.Author,
                                    },
                                })}
                            >
                                {name}
                            </a>
                        ) : (
                            <span>{name}</span>
                        )}
                        {!isLast && names.length > 2 && ", "}
                        {isSecondToLast && names.length > 1 && " and "}
                    </React.Fragment>
                )
            })}
        </>
    )
}
