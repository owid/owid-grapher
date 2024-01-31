import React, { useContext } from "react"
import cx from "classnames"
import { getLinkType } from "@ourworldindata/components"

import Image from "./Image.js"
import { useLinkedChart, useLinkedDocument } from "../utils.js"
import { DocumentContext } from "../OwidGdoc.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import { BAKED_GRAPHER_EXPORTS_BASE_URL } from "../../../settings/clientSettings.js"

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
    const { isPreviewing } = useContext(DocumentContext)

    if (errorMessage) {
        if (isPreviewing) {
            return (
                <div className={props.className}>
                    <BlockErrorFallback
                        className="span-cols-6 span-md-cols-10 span-sm-cols-12"
                        error={{
                            name: "Error with prominent link",
                            message: `${errorMessage} This block won't render when the page is published`,
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
        title = title ?? linkedDocument?.title
        description = description ?? linkedDocument?.excerpt
        thumbnail = thumbnail ?? linkedDocument?.["featured-image"]
    } else if (linkType === "grapher") {
        href = `${linkedChart?.resolvedUrl}`
        title = title ?? linkedChart?.title
        thumbnail = thumbnail ?? linkedChart?.thumbnail
        description =
            description ?? "See the data in our interactive visualization"
    } else if (linkType === "explorer") {
        href = `${linkedChart?.resolvedUrl}`
        title = title ?? `${linkedChart?.title} Data Explorer`
        thumbnail = thumbnail ?? linkedChart?.thumbnail
    }

    const Thumbnail = ({ thumbnail }: { thumbnail: string }) => {
        if (
            thumbnail.startsWith(BAKED_GRAPHER_EXPORTS_BASE_URL) ||
            thumbnail.endsWith("default-thumbnail.jpg")
        ) {
            return <img src={thumbnail} />
        } else {
            return <Image filename={thumbnail} containerType="thumbnail" />
        }
    }

    const anchorTagProps =
        linkType === "url"
            ? { target: "_blank", rel: "noopener noreferrer" }
            : undefined

    const textContainerClassName = thumbnail
        ? "col-sm-start-4 col-md-start-3 col-start-2 col-end-limit"
        : "col-start-1 col-end-limit"

    return (
        <a
            className={cx(props.className, "prominent-link")}
            href={href}
            {...anchorTagProps}
        >
            {thumbnail ? (
                <div className="prominent-link__image span-sm-cols-3 span-md-cols-2">
                    <Thumbnail thumbnail={thumbnail} />
                </div>
            ) : null}
            <div className={textContainerClassName}>
                <h3 className="h3-bold">{title}</h3>
                {description ? (
                    <p className="body-3-medium">{description}</p>
                ) : null}
            </div>
        </a>
    )
}
