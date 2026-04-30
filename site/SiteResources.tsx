import { latestUrl } from "./latest/latestUtils.js"

export const SiteResources = () => {
    return (
        <ul>
            <li>
                <a href={latestUrl()}>Latest</a>
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
