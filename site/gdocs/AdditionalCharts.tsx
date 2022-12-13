import React from "react"
import { Span } from "@ourworldindata/utils"
import { renderSpans } from "./utils.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

export const AdditionalCharts = ({
    items,
    className,
}: {
    items: Span[][]
    className?: string
}) => {
    return (
        <div className={className}>
            <h4>Additional charts</h4>
            <ul>
                {items.map((item, i) => (
                    <li key={i}>
                        {renderSpans(item)}{" "}
                        <FontAwesomeIcon icon={faArrowRight} />{" "}
                    </li>
                ))}
            </ul>
        </div>
    )
}
