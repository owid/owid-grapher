import { EntryMeta } from "@ourworldindata/utils"

export const SiteNavigationTopic = ({ topic }: { topic: EntryMeta }) => {
    return (
        <li className="SiteNavigationTopic">
            <a href={`/${topic.slug}`} data-track-note="header_navigation">
                <span className="label">{topic.title}</span>
            </a>
        </li>
    )
}
