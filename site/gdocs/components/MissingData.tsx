import React from "react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"

export const MissingData = ({ className }: { className?: string }) => (
    <div className={className}>
        <h4>
            <FontAwesomeIcon icon={faCircleInfo} />
            No data for this indicator
        </h4>
        <p>
            We are currently not aware of data for this indicator. You can
            notify us of available data for this indicator via our{" "}
            <a href="/feedback">feedback form</a>.
        </p>
    </div>
)
