import * as React from "react"

export default function TopicTags({
    className,
    topicTagsLinks,
    tagToSlugMap,
}: {
    className?: string
    topicTagsLinks: string[]
    tagToSlugMap: Record<string, string>
}) {
    // TODO (DB): mark topic pages
    const tags = topicTagsLinks
        ?.map((name) => ({ name, slug: tagToSlugMap[name] }))
        .filter((tag) => !!tag.slug)
    return (
        <div className={className}>
            <div className="topic-tags__label">
                See all data and research on:
            </div>
            <div className="topic-tags">
                {tags.map(({ name, slug }) => (
                    <a key={slug} className="topic-tag" href={`/${slug}`}>
                        {name}
                    </a>
                ))}
            </div>
        </div>
    )
}
