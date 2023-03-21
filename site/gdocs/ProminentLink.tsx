import React, { useContext } from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight"

import Image from "./Image.js"
import { useLinkedChart, useLinkedDocument } from "./utils.js"
import { ArticleContext } from "./OwidArticle.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"

export const ProminentLink = (props: {
    url: string
    className: string
    title?: string
    description?: string
    thumbnail?: string
}) => {
    const { url, className = "" } = props
    const { linkedDocument, errorMessage: linkedDocumentErrorMessage } =
        useLinkedDocument(url)
    const { linkedChart, errorMessage: linkedChartErrorMessage } =
        useLinkedChart(url)
    const errorMessage = linkedDocumentErrorMessage || linkedChartErrorMessage
    const { isPreviewing } = useContext(ArticleContext)

    if (errorMessage) {
        if (isPreviewing) {
            return (
                <div className={className}>
                    <BlockErrorFallback
                        className="span-cols-6 span-md-cols-10 span-sm-cols-12"
                        error={{
                            name: "Error with prominent link",
                            message:
                                errorMessage +
                                " This block won't render when the page is published",
                        }}
                    />
                </div>
            )
        } else return null
    }

    // If the link points to a gdoc_post or chart, we can use its metadata
    // But we still allow for overrides written in archie
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
