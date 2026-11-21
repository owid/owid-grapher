import { getCanonicalUrl } from "@ourworldindata/components"
import { OwidGdocType } from "@ourworldindata/types"
import {
    getAuthorInitials,
    getAuthorTeamAnchorUrl,
    useImage,
    useLinkedAuthor,
} from "../utils.js"
import Image from "./Image.js"
import { IS_ARCHIVE } from "../../../settings/clientSettings.mjs"
import { PROD_URL } from "../../SiteConstants.js"

const BASE_URL = IS_ARCHIVE ? PROD_URL : ""

export default function LinkedAuthor({
    className,
    name,
    includeImage,
    includeInitials,
    role,
}: {
    className?: string
    name: string
    includeImage?: boolean
    /** With includeImage, show the author's initials when there's no photo */
    includeInitials?: boolean
    role?: string
}) {
    const author = useLinkedAuthor(name)
    // With initials to fall back on, a photo only counts if it can render, so
    // archived pages (which leave photos out) show initials too
    const photoMetadata = useImage(author.featuredImage ?? undefined)
    const hasPhoto = includeInitials ? !!photoMetadata : !!author.featuredImage

    let avatar: React.ReactElement | undefined
    if (includeImage && hasPhoto && author.featuredImage) {
        avatar = (
            <Image
                className="linked-author-image"
                filename={author.featuredImage}
                alt={author.name}
                containerType="author-byline"
                shouldLightbox={false}
            />
        )
    } else if (includeImage && includeInitials) {
        avatar = (
            <span className="linked-author-initials" aria-hidden="true">
                <span className="linked-author-initials__letters">
                    {getAuthorInitials(author.name)}
                </span>
            </span>
        )
    }

    const path = author.slug
        ? getCanonicalUrl(BASE_URL, {
              slug: author.slug,
              content: { type: OwidGdocType.Author },
          })
        : getAuthorTeamAnchorUrl(author.name, BASE_URL)
    return (
        <span>
            <a className={className} href={path}>
                {avatar}
                {author.name}
            </a>
            {role && ` (${role})`}
        </span>
    )
}
