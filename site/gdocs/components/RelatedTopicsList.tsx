import cx from "clsx"
import { MinimalTag } from "@ourworldindata/utils"

/** The "Related topic pages:" chips in a standalone page's footer. */
export default function RelatedTopicsList({
    tags,
    className,
}: {
    tags?: MinimalTag[]
    className?: string
}) {
    if (!tags?.length) return null
    return (
        <div className={cx(className, "related-topics")}>
            <p className="body-3-regular">Related topic pages:</p>
            <ul>
                {tags.map((tag) => (
                    <li key={tag.name}>
                        <a href={`/${tag.slug}`}>{tag.name}</a>
                    </li>
                ))}
            </ul>
        </div>
    )
}
