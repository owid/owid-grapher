import { useContext } from "react"
import cx from "classnames"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faArrowUpRightFromSquare } from "@fortawesome/free-solid-svg-icons"
import { getLinkType } from "@ourworldindata/components"

import Image from "./Image.js"
import { useLinkedChart, useLinkedDocument } from "../utils.js"
import { DocumentContext } from "../DocumentContext.js"
import { BlockErrorFallback } from "./BlockErrorBoundary.js"
import { GRAPHER_DYNAMIC_THUMBNAIL_URL } from "../../../settings/clientSettings.js"
import {
    ARCHVED_THUMBNAIL_FILENAME,
    DEFAULT_THUMBNAIL_FILENAME,
    ContentGraphLinkType,
} from "@ourworldindata/types"

const Thumbnail = ({ thumbnail }: { thumbnail: string }) => {
    if (
        thumbnail.startsWith(GRAPHER_DYNAMIC_THUMBNAIL_URL) ||
        thumbnail.endsWith(ARCHVED_THUMBNAIL_FILENAME) ||
        thumbnail.endsWith(DEFAULT_THUMBNAIL_FILENAME)
    ) {
        return <img src={thumbnail} />
    } else {
        return <Image filename={thumbnail} containerType="thumbnail" />
    }
}

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
    if (linkedDocument) {
        href = linkedDocument.url
        title ??= linkedDocument.title
        description ??= linkedDocument.excerpt
        thumbnail ??= linkedDocument["featured-image"]
    } else if (linkType === ContentGraphLinkType.Grapher) {
        href = `${linkedChart?.resolvedUrl}`
        title ??= linkedChart?.title
        thumbnail ??= linkedChart?.thumbnail
        description ??= "See the data in our interactive visualization"
    } else if (linkType === ContentGraphLinkType.Explorer) {
        href = `${linkedChart?.resolvedUrl}`
        title ??= `${linkedChart?.title} Data Explorer`
        thumbnail ??= linkedChart?.thumbnail
        description ??= linkedChart?.subtitle
    }

    const anchorTagProps =
        linkType === "url" ? { target: "_blank", rel: "noopener" } : undefined

    const textContainerClassName = thumbnail
        ? "col-sm-start-4 col-md-start-3 col-start-2 col-end-limit"
        : "col-start-1 col-end-limit"

    const shouldVerticallyCenter = !description

    return (
        <a
            className={cx(props.className, "prominent-link")}
            href={href}
            {...anchorTagProps}
        >
            {thumbnail ? (
                <div
                    className={cx(
                        "span-sm-cols-3 span-md-cols-2 prominent-link__image",
                        {
                            "prominent-link__image--centered":
                                shouldVerticallyCenter,
                        }
                    )}
                >
                    <Thumbnail thumbnail={thumbnail} />
                </div>
            ) : null}
            <div
                className={cx(textContainerClassName, {
                    "prominent-link__text--centered": shouldVerticallyCenter,
                })}
            >
                <div className="prominent-link__heading-wrapper">
                    <h3 className="h3-bold">{title}</h3>
                    {linkType === "url" && (
                        <FontAwesomeIcon
                            className="prominent-link__icon-external"
                            icon={faArrowUpRightFromSquare}
                        />
                    )}
                </div>
                {description ? (
                    <p className="body-3-medium">{description}</p>
                ) : null}
            </div>
        </a>
    )
}
