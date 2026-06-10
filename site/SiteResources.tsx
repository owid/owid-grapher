import { buildLatestPagePath } from "./latest/latestUtils.js"

export const SiteResources = () => {
    return (
        <ul>
            <li>
                <a href={buildLatestPagePath("data-insight")}>Data Insights</a>
            </li>
            <li>
                <a href="/explorers">Data Explorers</a>
            </li>
            <li>
                <a href="/sdgs">SDG Tracker</a>
            </li>
            <li>
                <a href="/teaching">Teaching with OWID</a>
            </li>
        </ul>
    )
}
