import React from "react"
import { faEdit } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

export const GdocsEditLink = ({
    gdocId,
    style,
}: {
    gdocId: string
    style?: React.CSSProperties
}) => (
    <a
        href={`https://docs.google.com/document/d/${gdocId}/edit`}
        target={gdocId}
        style={style}
        className="gdoc-edit-link"
        rel="noopener noreferrer"
    >
        Edit
        <FontAwesomeIcon style={{ marginLeft: "0.4em" }} icon={faEdit} />
    </a>
)
