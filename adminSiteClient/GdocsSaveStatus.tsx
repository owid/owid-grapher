import React from "react"
import { faArrowsRotate } from "@fortawesome/free-solid-svg-icons/faArrowsRotate"
import { faCheckCircle } from "@fortawesome/free-solid-svg-icons/faCheckCircle"
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
