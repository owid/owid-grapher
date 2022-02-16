import React from "react"
import { SubNavId } from "../clientUtils/owidTypes.js"
import { getSubnavItem, subnavs } from "./SiteSubnavigation.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons/faArrowLeft.js"

export const BackToTopic = ({
    subnavId,
}: {
    subnavId: SubNavId
}): JSX.Element | null => {
    const subnavItem = getSubnavItem(subnavId, subnavs[subnavId])
    if (!subnavItem) return null

    return (
        <a className="back-to-topic" href={subnavItem.href}>
            <FontAwesomeIcon icon={faArrowLeft} />
            <span>{subnavItem.label}</span>
        </a>
    )
}
