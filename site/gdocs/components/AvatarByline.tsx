import cx from "clsx"
import LinkedAuthor from "./LinkedAuthor.js"

/**
 * The avatar byline short-form content carries: each author as a linked
 * name with their photo beside it, wrapping as a row. One component so a
 * data insight or data update reads the same on its standalone page, in the
 * /latest feed and in a plain announcement — the callers only add spacing.
 *
 * Always upright. The feed sets its text-only bylines (condensed cards,
 * article cards) in italics; an avatar byline is a different element and
 * stays upright even when an author's photo doesn't resolve (no published
 * author page), so the same byline can't flip between two styles depending
 * on whose name is in it.
 *
 * Renders nothing for no authors, so callers needn't guard.
 */
export default function AvatarByline({
    authors,
    className,
}: {
    authors: string[]
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
                    includeImage={true}
                />
            ))}
        </div>
    )
}
