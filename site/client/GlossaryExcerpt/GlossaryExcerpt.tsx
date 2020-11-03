import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons/faExternalLinkAlt"

export const GlossaryExcerpt_name = "GlossaryExcerpt"

export const GlossaryExcerpt = ({
    excerpt,
    slug,
    label,
}: {
    excerpt: string
    slug: string
    label: string
}) => {
    return (
        <span className="glossary-excerpt">
            <span className="title">Definition</span>
            {excerpt}
            <a target="_blank" rel="noopener" href={`/glossary#${slug}`}>
                Read more about {label.toLowerCase()}
                <FontAwesomeIcon icon={faExternalLinkAlt} />
            </a>
        </span>
    )
}
