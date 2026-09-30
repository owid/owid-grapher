import cx from "clsx"
import LinkedAuthor from "./LinkedAuthor.js"

/** Linked author names and photos, wrapping as a row. Always upright, including
 * when an author has no photo. Callers supply spacing through className. */
export default function AvatarByline({
    authors,
    authorRoles,
    className,
}: {
    authors: string[]
    authorRoles?: Record<string, string>
    /** Layout hooks the caller owns — margins, z-index — not type or colour. */
    className?: string
}) {
    if (authors.length === 0) return null
    return (
        <div className={cx("avatar-byline body-3-medium", className)}>
            {authors.map((name) => (
                <LinkedAuthor
                    key={name}
                    className="avatar-byline__author"
                    name={name}
                    role={authorRoles?.[name]}
                    includeImage={true}
                />
            ))}
        </div>
    )
}
