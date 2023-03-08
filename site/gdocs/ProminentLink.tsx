import React from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight"

import Image from "./Image.js"
import { useLinkedDocument } from "./utils.js"

export const ProminentLink = (props: {
    url: string
    className: string
    title?: string
    description?: string
    thumbnail?: string
}) => {
    const { url, className = "" } = props
    // If the link points to a gdoc_post, we can use its metadata
    // But we still allow for overrides written in archie
    const linkedDocument = useLinkedDocument(url)
    if (linkedDocument && !linkedDocument.published) return null

    const title = props.title || linkedDocument?.content.title
    const description = props.description || linkedDocument?.content.excerpt
    const href = linkedDocument ? `/${linkedDocument.slug}` : url
    const anchorTagProps = linkedDocument
        ? {}
        : { target: "_blank", rel: "noopener noreferrer" }
    const thumbnail = props.thumbnail || linkedDocument?.content.cover
    const textContainerClassName = thumbnail
        ? "col-start-2 col-md-start-3 col-end-limit"
        : "col-md-start-1 col-end-limit"

    return (
        <div className={cx(className, "prominent-link")}>
            {thumbnail ? (
                <div className="prominent-link__image span-cols-1 span-md-cols-2">
                    <Image filename={thumbnail} containerType="thumbnail" />
                </div>
            ) : null}
            <div className={textContainerClassName}>
                <a href={href} {...anchorTagProps}>
                    <h3 className="h3-bold">{title}</h3>
                    <FontAwesomeIcon icon={faArrowRight} />
                </a>
                <p className="body-3-medium">{description}</p>
            </div>
        </div>
    )
}
