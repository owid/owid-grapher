import * as React from "react"

export const ABOUT_LINKS = [
    { title: "About Us", href: "/about" },
    { title: "Organization", href: "/organization" },
    { title: "Funding", href: "/funding" },
    { title: "Team", href: "/team" },
    { title: "Jobs", href: "/jobs" },
    { title: "FAQs", href: "/faqs" },
]

export function SiteAbout() {
    return (
        <ul>
            {ABOUT_LINKS.map(({ title, href }) => (
                <li key={href}>
                    <a href={href}>{title}</a>
                </li>
            ))}
        </ul>
    )
}
