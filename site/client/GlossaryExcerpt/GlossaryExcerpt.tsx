import React from "react"

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
            {excerpt}
            <a href={`/glossary/${slug}`}>Read more</a>
        </span>
    )
}
