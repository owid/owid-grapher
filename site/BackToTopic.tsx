import React from "react"
import { SubNavId } from "../clientUtils/owidTypes"
import { getSubnavItem, subnavs } from "./SiteSubnavigation"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons/faArrowLeft"

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
