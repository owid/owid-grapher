import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons/faChevronLeft"

export const co2CountryProfilePath = "/co2-country-profile"

interface SubnavItem {
    label: string
    href: string
    id: string
    highlight?: boolean
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
        {
            label: "By country",
            href: "/coronavirus#coronavirus-country-profiles",
            id: "by-country",
            highlight: true
        },
        {
            label: "Data explorer",
            href: "/coronavirus-data-explorer",
            id: "data-explorer",
            highlight: true
        },
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
            label: "Exemplars",
            href: "/identify-covid-exemplars",
            id: "exemplars"
        },
        { label: "All charts", href: "/coronavirus-data", id: "data" }
    ],
    co2: [
        {
            label: "CO₂ and GHG Emissions",
            href: "/co2-and-other-greenhouse-gas-emissions",
            id: "co2-and-ghg-emissions"
        },
        {
            label: "By country",
            href: co2CountryProfilePath,
            id: "by-country",
            highlight: true
        },
        { label: "CO₂ emissions", href: "/co2-emissions", id: "co2-emissions" },
        { label: "By fuel", href: "/emissions-by-fuel", id: "by-fuel" },
        {
            label: "GHG emissions",
            href: "/greenhouse-gas-emissions",
            id: "ghg-emissions"
        },
        {
            label: "By sector",
            href: "/emissions-by-sector",
            id: "by-sector"
        },
        {
            label: "Future emissions",
            href: "/future-emissions",
            id: "future-emissions"
        },
        {
            label: "Atm concentrations",
            href: "/atmospheric-concentrations",
            id: "atm-concentrations"
        }
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
                        <ul className="site-subnavigation-links">
                            {subnavLinks.map(
                                ({ href, label, id, highlight }, idx) => {
                                    const classes: string[] = []
                                    const dataTrackNote = [
                                        subnavId,
                                        "subnav",
                                        id
                                    ].join("-")
                                    if (id === subnavCurrentId)
                                        classes.push("current")
                                    if (highlight) classes.push("highlight")
                                    return (
                                        <li
                                            className={
                                                (classes.length &&
                                                    classes.join(" ")) ||
                                                ""
                                            }
                                            key={href}
                                        >
                                            <a
                                                href={href}
                                                data-track-note={dataTrackNote}
                                            >
                                                {label}
                                                {idx === 0 && (
                                                    <FontAwesomeIcon
                                                        icon={faChevronLeft}
                                                    />
                                                )}
                                            </a>
                                        </li>
                                    )
                                }
                            )}
                        </ul>
                    </div>
                </div>
            </div>
        ) : null
    }
}
