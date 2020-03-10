import * as React from "react"

interface SubnavItem {
    label: string
    href: string
    id: string
}

const subnavs: { [subnavId: string]: SubnavItem[] } = {
    about: [
        // `label` is shown in the UI, `id` is specified as a formatting option
        // on a page (the top html comment in WordPress)
        { label: "About", href: "/about", id: "about" },
        { label: "Motivation", href: "/motivation", id: "motivation" },
        { label: "Team", href: "/team", id: "team" },
        { label: "Jobs", href: "/jobs", id: "jobs" },
        { label: "Audience & Coverage", href: "/coverage", id: "coverage" },
        {
            label: "History",
            href: "/history-of-our-world-in-data",
            id: "history"
        },
        { label: "Supporters", href: "/supporters", id: "supporters" },
        { label: "FAQs", href: "/faqs", id: "faqs" },
        {
            label: "How-Tos",
            href: "/how-to-use-our-world-in-data",
            id: "how-tos"
        },
        { label: "Grapher", href: "/owid-grapher", id: "grapher" },
        { label: "Contact", href: "/about#contact", id: "contact" }
    ]
}

export class SiteSubnavigation extends React.Component<{
    subnavId: string
    subnavCurrentId?: string
}> {
    render() {
        const { subnavId, subnavCurrentId } = this.props
        const subnavLinks = subnavs[subnavId]
        if (subnavLinks) {
            return (
                <div className="site-subnavigation">
                    <div className="site-subnavigation-scroll">
                        <ul className="site-subnavigation-links">
                            {subnavLinks.map(({ href, label, id }) => (
                                <li
                                    className={
                                        id === subnavCurrentId
                                            ? "current"
                                            : undefined
                                    }
                                    key={href}
                                >
                                    <a href={href}>{label}</a>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            )
        } else {
            return undefined
        }
    }
}
