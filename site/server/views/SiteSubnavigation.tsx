import * as React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faChevronLeft } from "@fortawesome/free-solid-svg-icons/faChevronLeft"

interface SubnavItem {
    label: string
    href: string
    id: string
    highlight?: boolean
}

const SubNavIds = ["about", "coronavirus", "co2", "energy"] as const
export type SubNavId = typeof SubNavIds[number]

const subnavs: { [key in SubNavId]: SubnavItem[] } = {
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
            id: "history",
        },
        { label: "Supporters", href: "/supporters", id: "supporters" },
        { label: "FAQs", href: "/faqs", id: "faqs" },
        {
            label: "How-Tos",
            href: "/how-to-use-our-world-in-data",
            id: "how-tos",
        },
        { label: "Grapher", href: "/owid-grapher", id: "grapher" },
        { label: "Contact", href: "/about#contact", id: "contact" },
    ],
    coronavirus: [
        { label: "Coronavirus", href: "/coronavirus", id: "coronavirus" },
        {
            label: "By country",
            href: "/coronavirus#coronavirus-country-profiles",
            id: "by-country",
            highlight: true,
        },
        {
            label: "Data explorer",
            href: "/coronavirus-data-explorer",
            id: "data-explorer",
            highlight: true,
        },
        { label: "Deaths", href: "/covid-deaths", id: "deaths" },
        { label: "Cases", href: "/covid-cases", id: "cases" },
        { label: "Tests", href: "/coronavirus-testing", id: "testing" },
        {
            label: "Mortality risk",
            href: "/mortality-risk-covid",
            id: "mortality-risk",
        },
        {
            label: "Policy responses",
            href: "/policy-responses-covid",
            id: "policy-responses",
        },
        {
            label: "Exemplars",
            href: "/identify-covid-exemplars",
            id: "exemplars",
        },
        { label: "All charts", href: "/coronavirus-data", id: "data" },
    ],
    co2: [
        {
            label: "CO₂ and GHG Emissions",
            href: "/co2-and-other-greenhouse-gas-emissions",
            id: "co2-and-ghg-emissions",
        },
        {
            label: "By country",
            href:
                "/co2-and-other-greenhouse-gas-emissions#co2-and-greenhouse-gas-emissions-country-profiles",
            id: "by-country",
            highlight: true,
        },
        {
            label: "Data explorer",
            href: "/explorers/co2",
            id: "co2-data-explorer",
        },
        { label: "CO₂ emissions", href: "/co2-emissions", id: "co2-emissions" },
        { label: "CO₂ by fuel", href: "/emissions-by-fuel", id: "by-fuel" },
        {
            label: "GHG emissions",
            href: "/greenhouse-gas-emissions",
            id: "ghg-emissions",
        },
        { label: "By sector", href: "/emissions-by-sector", id: "by-sector" },
        {
            label: "Emissions drivers",
            href: "/emissions-drivers",
            id: "emissions-drivers",
        },
        {
            label: "Atmospheric concentrations",
            href: "/atmospheric-concentrations",
            id: "atm-concentrations",
        },
    ],
    energy: [
        {
            label: "Energy",
            href: "/energy",
            id: "energy",
        },
        {
            label: "By country",
            href: "/energy#energy-country-profiles",
            id: "by-country",
            highlight: true,
        },
        {
            label: "Data explorer",
            href: "/explorers/energy",
            id: "energy-data-explorer",
        },
        { label: "Energy access", href: "/energy-access", id: "energy-access" },
        {
            label: "Production & Consumption",
            href: "/energy-production-consumption",
            id: "production-consumption",
        },
        { label: "Energy mix", href: "/energy-mix", id: "energy-mix" },
        {
            label: "Electricity mix",
            href: "/electricity-mix",
            id: "electricity-mix",
        },
        { label: "Fossil fuels", href: "/fossil-fuels", id: "fossil-fuels" },
        {
            label: "Renewables",
            href: "/renewable-energy",
            id: "renewable-energy",
        },
        { label: "Nuclear", href: "/nuclear-energy", id: "nuclear-energy" },
    ],
}

export class SiteSubnavigation extends React.Component<{
    subnavId: SubNavId
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
                                        id,
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
