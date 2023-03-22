import React, { useContext } from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowRight } from "@fortawesome/free-solid-svg-icons/faArrowRight"
import { getLinkType } from "@ourworldindata/utils"

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
    const linkType = getLinkType(props.url)
    const { linkedDocument, errorMessage: linkedDocumentErrorMessage } =
        useLinkedDocument(props.url)
    const { linkedChart, errorMessage: linkedChartErrorMessage } =
        useLinkedChart(props.url)
    const errorMessage = linkedDocumentErrorMessage || linkedChartErrorMessage
    const { isPreviewing } = useContext(ArticleContext)

    if (errorMessage) {
        if (isPreviewing) {
            return (
                <div className={props.className}>
                    <BlockErrorFallback
                        className="span-cols-6 span-md-cols-10 span-sm-cols-12"
                        error={{
                            name: "Error with prominent link",
                            message: `${errorMessage}\nThis block won't render when the page is published`,
                        }}
                    />
                </div>
            )
        } else return null
    }

    // If the link points to a gdoc_post or chart, we can use its metadata
    // But we still allow for overrides written in archie
    let href: string = props.url
    let title: string | undefined = props.title
    let description: string | undefined = props.description
    let thumbnail: string | undefined = props.thumbnail
    if (linkType === "gdoc") {
        href = `/${linkedDocument?.slug}`
        title = title ?? linkedDocument?.content.title
        description = description ?? linkedDocument?.content.excerpt
        thumbnail = thumbnail ?? linkedDocument?.content.cover
    } else if (linkType === "grapher" || linkType === "explorer") {
        href = `${linkedChart?.path}`
        title = title ?? linkedChart?.title
        thumbnail = thumbnail ?? linkedChart?.thumbnail
        // TODO: this won't work with the Image component
    }

    const anchorTagProps =
        linkType === "url"
            ? { target: "_blank", rel: "noopener noreferrer" }
            : undefined

    const textContainerClassName = thumbnail
        ? "col-start-2 col-md-start-3 col-end-limit"
        : "col-start-1 col-end-limit"

    return (
        <div className={cx(props.className, "prominent-link")}>
            {thumbnail ? (
                <div className="prominent-link__image span-cols-1 span-md-cols-2">
                    {linkType === "gdoc" ? (
                        <Image filename={thumbnail} containerType="thumbnail" />
                    ) : (
                        <img src={thumbnail} />
                    )}
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
