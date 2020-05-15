import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons/faChevronLeft"

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
    ],
    coronavirus: [
        { label: "Coronavirus", href: "/coronavirus", id: "coronavirus" },
        { label: "Deaths", href: "/covid-deaths", id: "deaths" },
        { label: "Cases", href: "/covid-cases", id: "cases" },
        { label: "Tests", href: "/coronavirus-testing", id: "testing" },
        {
            label: "Mortality risk",
            href: "/mortality-risk-covid",
            id: "mortality-risk"
        },
        {
            label: "Policy responses",
            href: "/policy-responses-covid",
            id: "policy-responses"
        },
        {
            label: "Data explorer",
            href: "/coronavirus-data-explorer",
            id: "data-explorer"
        },
        { label: "All charts", href: "/coronavirus-data", id: "data" }
    ]
}

export class SiteSubnavigation extends React.Component<{
    subnavId: string
    subnavCurrentId?: string
}> {
    render() {
        const { subnavId, subnavCurrentId } = this.props
        const subnavLinks = subnavs[subnavId]
        return subnavLinks ? (
            <div className="offset-subnavigation">
                <div className="site-subnavigation">
                    <div className="site-subnavigation-scroll">
                        <div className="site-subnavigation-title">
                            <a href={subnavLinks[0].href}>
                                {subnavLinks[0].label}
                                <FontAwesomeIcon icon={faChevronLeft} />
                            </a>
                        </div>
                        <ul className="site-subnavigation-links">
                            {subnavLinks.slice(1).map(({ href, label, id }) => (
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
            </div>
        ) : null
    }
}
