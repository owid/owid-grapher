import * as React from "react"
import { getCanonicalUrl } from "@ourworldindata/components"
import { OwidGdocType } from "@ourworldindata/types"
import { useLinkedAuthor } from "../utils.js"
import Image from "./Image.js"

export default function LinkedAuthor({
    className,
    name,
    includeImage,
}: {
    className?: string
    name: string
    includeImage?: boolean
}) {
    const author = useLinkedAuthor(name)
    const image =
        includeImage && author.featuredImage ? (
            <Image
                className="linked-author-image"
                filename={author.featuredImage}
                alt={author.name}
                containerType="author-byline"
                shouldLightbox={false}
            />
        ) : undefined

    // Somehow, using a fragment here messes up the hydration process and causes
    // some links to be applied to the wrong authors, but only if the first
    // author is unlinked (which probably gets tangled with the "By: " text
    // above). Additional markup, here in the form of a span, works more
    // reliably.
    if (!author.slug) {
        return (
            <span className={className}>
                {image}
                {author.name}
            </span>
        )
    }

    const path = getCanonicalUrl("", {
        slug: author.slug,
        content: { type: OwidGdocType.Author },
    })
    return (
        <a className={className} href={path}>
            {image}
            {author.name}
        </a>
    )
}
