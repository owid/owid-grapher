import { useContext } from "react"
import { Autocomplete } from "../../search/Autocomplete.js"
import { AttachmentsContext } from "../AttachmentsContext.js"
import { commafyNumber } from "@ourworldindata/utils"
import { SEARCH_BASE_PATH } from "../../search/searchUtils.js"

export function HomepageSearch(props: { className?: string }) {
    const { homepageMetadata } = useContext(AttachmentsContext)
    const chartCount = homepageMetadata?.chartCount
    const topicCount = homepageMetadata?.topicCount
    const message =
        chartCount && topicCount ? (
            <>
                <a href={SEARCH_BASE_PATH}>
                    {commafyNumber(chartCount)} charts
                </a>{" "}
                across{" "}
                <a
                    href="#all-topics"
                    className="homepage-search__all-topics-link"
                >
                    {commafyNumber(topicCount)} topics
                </a>
                <span className="homepage-search__open-source-notice">
                    All free: open access and open source
                </span>
            </>
        ) : (
            <>
                Thousands of charts across 200 topics - All free: open access
                and open source
            </>
        )
    return (
        <div className={props.className}>
            <h2 className="h1-semibold span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2">
                Research and data to make progress against the world’s largest
                problems.
            </h2>
            <Autocomplete
                className="span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2"
                panelClassName="homepage-search__panel"
            />
            <p className="span-cols-14 homepage-search__tagline">{message}</p>
        </div>
    )
}
