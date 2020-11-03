import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons/faExternalLinkAlt"

export const GlossaryExcerpt_name = "GlossaryExcerpt"

export const GlossaryExcerpt = ({
    excerpt,
    slug,
}: {
    excerpt: string
    slug: string
}) => {
    return (
        <span className="glossary-excerpt">
            <span className="title">Definition</span>
            {excerpt}
            <a target="_blank" rel="noopener" href={`/glossary#${slug}`}>
                Read more
                <FontAwesomeIcon icon={faExternalLinkAlt} />
            </a>
        </span>
    )
}
