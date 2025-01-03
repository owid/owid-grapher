import { ABOUT_LINKS } from "./SiteConstants.js"

export function SiteAbout() {
    return (
        <ul>
            {ABOUT_LINKS.map(({ title, url }) => (
                <li key={url}>
                    <a href={url}>{title}</a>
                </li>
            ))}
        </ul>
    )
}
