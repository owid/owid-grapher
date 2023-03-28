import React from "react"
import {
    faArrowsRotate,
    faCheckCircle,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

export const GdocsSaveStatus = ({ hasChanges }: { hasChanges: boolean }) => (
    <span className="muted">
        {hasChanges ? (
            <span>
                <FontAwesomeIcon icon={faArrowsRotate} /> Saving...
            </span>
        ) : (
            <span>
                <FontAwesomeIcon icon={faCheckCircle} /> Saved
            </span>
        )}
    </span>
)
