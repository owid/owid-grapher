import { TagGraphNode } from "@ourworldindata/utils"

export const SiteNavigationTopic = ({ topic }: { topic: TagGraphNode }) => {
    return (
        <li className="SiteNavigationTopic">
            <a href={`/${topic.slug}`} data-track-note="header_navigation">
                <span className="label">{topic.name}</span>
            </a>
        </li>
    )
}
