import * as React from "react"
import { faSpinner } from "@fortawesome/free-solid-svg-icons/faSpinner"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

export const LoadingIndicator = () => {
    return (
        <div className="loading-indicator">
            <FontAwesomeIcon icon={faSpinner} spin />
        </div>
    )
}
