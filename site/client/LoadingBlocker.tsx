import * as React from "react"
import { faSpinner } from "@fortawesome/free-solid-svg-icons/faSpinner"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export const LoadingBlocker = () => {
    return (
        <div className="loading-blocker">
            <FontAwesomeIcon icon={faSpinner} spin />
        </div>
    )
}
