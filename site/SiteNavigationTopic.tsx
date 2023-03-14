import React from "react"
import { EntryMeta } from "@ourworldindata/utils"

export const SiteNavigationTopic = ({ topic }: { topic: EntryMeta }) => {
    return (
        <li className="SiteNavigationTopic">
            <a href={`/${topic.slug}`} data-track-note="header-navigation">
                <span className="label">{topic.title}</span>
            </a>
        </li>
    )
}
