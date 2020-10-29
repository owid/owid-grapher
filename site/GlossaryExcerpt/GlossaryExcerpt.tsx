import React from "react"

// Leave as a function so GlossaryExcerpt.name resolves
export function GlossaryExcerpt({
    excerpt,
    slug,
}: {
    excerpt: string
    slug: string
}) {
    return (
        <span className="glossary-excerpt">
            {excerpt}
            <a href={`/glossary/${slug}`}>Read more</a>
        </span>
    )
}
