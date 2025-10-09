import { useContext } from "react"
import { Autocomplete } from "../../search/Autocomplete.js"
import { AttachmentsContext } from "../AttachmentsContext.js"
import { commafyNumber } from "@ourworldindata/utils"
import { SEARCH_BASE_PATH } from "../../search/searchUtils.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faArrowRight,
    faBookmark,
    faChartLine,
    faMagnifyingGlassChart,
} from "@fortawesome/free-solid-svg-icons"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"

export function HomepageSearch(props: { className?: string }) {
    const { homepageMetadata } = useContext(AttachmentsContext)
    const chartCount = homepageMetadata?.chartCount
    const topicCount = homepageMetadata?.topicCount
    const explorerCount = homepageMetadata?.explorerCount
    const message =
        chartCount && topicCount && explorerCount ? (
            <div>
                <div className="homepage-search__links">
                    <a
                        className="homepage-search__link body-3-medium"
                        href={SEARCH_BASE_PATH}
                    >
                        <FontAwesomeIcon icon={faChartLine} />{" "}
                        {commafyNumber(chartCount)} Charts
                    </a>
                    <a
                        className="homepage-search__link body-3-medium"
                        href="#all-topics"
                    >
                        <FontAwesomeIcon icon={faBookmark} />{" "}
                        {commafyNumber(topicCount)} Topic Pages
                    </a>
                    <a
                        className="homepage-search__link body-3-medium"
                        href="/explorers"
                    >
                        <FontAwesomeIcon icon={faMagnifyingGlassChart} />{" "}
                        {commafyNumber(explorerCount)} Data Explorers
                    </a>
                </div>
                <div className="homepage-search__links--mobile">
                    <a href="/data" className="body-3-medium">
                        {commafyNumber(chartCount)} Charts
                    </a>{" "}
                    across {commafyNumber(topicCount)} topics
                </div>
                <p className="homepage-search__tagline">
                    All free: open access and open source
                </p>
            </div>
        ) : (
            <p className="homepage-search__tagline">
                Thousands of charts across 200 topics - All free: open access
                and open source
            </p>
        )
    return (
        <div className={props.className}>
            <h2 className="h1-semibold span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2">
                Research and data to make progress against the world’s largest
                problems.
            </h2>
            <a
                href={`${BAKED_BASE_URL}/about#our-mission`}
                className="homepage-search__about-link span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2"
            >
                Read about our mission <FontAwesomeIcon icon={faArrowRight} />
            </a>
            <Autocomplete
                className="span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2"
                panelClassName="homepage-search__panel"
            />
            <div className="span-cols-14 homepage-search__links-and-tagline">
                {message}
            </div>
        </div>
    )
}
