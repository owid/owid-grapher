import React from "react"
import { faEdit } from "@fortawesome/free-solid-svg-icons/faEdit"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { OwidArticleType } from "../clientUtils/owidTypes.js"

export const GdocsEditLink = ({ gdoc }: { gdoc: OwidArticleType }) => (
    <a
        href={`https://docs.google.com/document/d/${gdoc.id}/edit`}
        target="_blank"
        rel="noopener"
        style={{ fontSize: "0.8em" }}
    >
        Edit <FontAwesomeIcon icon={faEdit} />
    </a>
)
