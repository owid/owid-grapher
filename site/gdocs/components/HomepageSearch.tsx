import React, { useContext } from "react"
import { Autocomplete } from "../../search/Autocomplete.js"
import { AttachmentsContext } from "../OwidGdoc.js"

export function HomepageSearch(props: { className?: string }) {
    const { homepageMetadata } = useContext(AttachmentsContext)
    const chartCount = homepageMetadata?.chartCount
    const topicCount = homepageMetadata?.topicCount
    const message =
        chartCount && topicCount
            ? `${chartCount} charts across ${topicCount} topics — All free: open access and open source`
            : "Thousand of charts across 200 topics - All free: open access and open source"
    return (
        <div className={props.className}>
            <h2 className="h1-semibold span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2">
                Research and data to make progress against the world’s largest
                problems.
            </h2>
            <Autocomplete
                placeholder="Try “COVID-19”, “GDP”, “Energy”, “CO2 emissions per capita”…"
                className="span-cols-6 col-start-5 span-md-cols-10 col-md-start-3 span-sm-cols-12 col-sm-start-2"
                detachedMediaQuery="none"
            />
            <p className="span-cols-14">{message}</p>
        </div>
    )
}
