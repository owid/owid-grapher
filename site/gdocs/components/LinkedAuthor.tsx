import { getCanonicalUrl } from "@ourworldindata/components"
import { OwidGdocType } from "@ourworldindata/types"
import { useLinkedAuthor } from "../utils.js"
import Image from "./Image.js"
import { IS_ARCHIVE } from "../../../settings/clientSettings.js"
import { PROD_URL } from "../../SiteConstants.js"

const BASE_URL = IS_ARCHIVE ? PROD_URL : ""

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

    const path = getCanonicalUrl(BASE_URL, {
        // If there's no author slug, this will link to /team/
        slug: author.slug || "",
        content: { type: OwidGdocType.Author },
    })
    return (
        <a className={className} href={path}>
            {image}
            {author.name}
        </a>
    )
}
