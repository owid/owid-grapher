import { getCanonicalUrl } from "@ourworldindata/components"
import { OwidGdocType } from "@ourworldindata/types"
import { getAuthorTeamAnchorUrl, useLinkedAuthor } from "../utils.js"
import Image from "./Image.js"
import { IS_ARCHIVE } from "../../../settings/clientSettings.js"
import { PROD_URL } from "../../SiteConstants.js"

const BASE_URL = IS_ARCHIVE ? PROD_URL : ""

export default function LinkedAuthor({
    className,
    name,
    includeImage,
    role,
}: {
    className?: string
    name: string
    includeImage?: boolean
    role?: string
}) {
    const author = useLinkedAuthor(name)
    const displayRole = role ?? author.role
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

    const path = author.slug
        ? getCanonicalUrl(BASE_URL, {
              slug: author.slug,
              content: { type: OwidGdocType.Author },
          })
        : getAuthorTeamAnchorUrl(author.name, BASE_URL)
    return (
        <span>
            <a className={className} href={path}>
                {image}
                {author.name}
            </a>
            {displayRole && ` (${displayRole})`}
        </span>
    )
}
