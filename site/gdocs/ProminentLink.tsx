import React, { useContext } from "react"
import cx from "classnames"

import Image from "./Image.js"
import { useLinkedDocument } from "./utils.js"
import { DocumentContext } from "./OwidGdoc.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import { getLinkType } from "@ourworldindata/utils"

export const ProminentLink = (props: {
    url: string
    className: string
    title?: string
    description?: string
    thumbnail?: string
}) => {
    const { url, className = "" } = props
    const linkType = getLinkType(url)
    const linkedDocument = useLinkedDocument(url)
    const { isPreviewing } = useContext(DocumentContext)
    if (linkType == "gdoc") {
        let error: Error | undefined = undefined
        if (!linkedDocument) {
            error = {
                name: "Error in prominent link",
                message: `Google doc URL ${url} isn't registered. This block will not render when the page is baked.`,
            }
        } else if (!linkedDocument.published) {
            error = {
                name: "Error in prominent link",
                message: `Article with slug "${linkedDocument.slug}" isn't published. This block will not render when the page is baked.`,
            }
        }
        if (error) {
            if (isPreviewing) {
                return (
                    <div className={className}>
                        <BlockErrorFallback
                            className="span-cols-6"
                            error={error}
                        />
                    </div>
                )
            } else return null
        }
    }

    // If the link points to a gdoc_post, we can use its metadata
    // But we still allow for overrides written in archie
    const title = props.title || linkedDocument?.content.title
    const description = props.description || linkedDocument?.content.excerpt
    const href = linkedDocument ? `/${linkedDocument.slug}` : url
    const anchorTagProps = linkedDocument
        ? {}
        : { target: "_blank", rel: "noopener noreferrer" }
    const thumbnail = props.thumbnail || linkedDocument?.content.cover
    const textContainerClassName = thumbnail
        ? "col-sm-start-4 col-md-start-3 col-start-2 col-end-limit"
        : "col-start-1 col-end-limit"

    return (
        <a
            className={cx(className, "prominent-link")}
            href={href}
            {...anchorTagProps}
        >
            {thumbnail ? (
                <div className="prominent-link__image span-sm-cols-3 span-md-cols-2">
                    <Image filename={thumbnail} containerType="thumbnail" />
                </div>
            ) : null}
            <div className={textContainerClassName}>
                <h3 className="h3-bold">{title}</h3>
                <p className="body-3-medium">{description}</p>
            </div>
        </a>
    )
}
