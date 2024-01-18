import React, { useContext } from "react"
import cx from "classnames"
import {
    EnrichedBlockResearchAndWriting,
    EnrichedBlockResearchAndWritingLink,
    RESEARCH_AND_WRITING_ID,
} from "@ourworldindata/utils"
import { useLinkedDocument } from "../utils.js"
import { formatAuthors } from "../../clientFormatting.js"
import Image from "./Image.js"
import { DocumentContext } from "../OwidGdoc.js"

type ResearchAndWritingProps = {
    className?: string
} & EnrichedBlockResearchAndWriting

function ResearchAndWritingLinkContainer(
    props: EnrichedBlockResearchAndWritingLink & {
        className?: string
        isSmall?: boolean
        shouldHideThumbnail?: boolean
        shouldHideSubtitle?: boolean
    }
) {
    let {
        value: { url, title, subtitle, authors, filename },
        shouldHideThumbnail = false,
        isSmall = false,
        shouldHideSubtitle = false,
        className,
    } = props
    const { linkedDocument, errorMessage } = useLinkedDocument(url)
    const { isPreviewing } = useContext(DocumentContext)

    if (isPreviewing && errorMessage) {
        return (
            <div className={cx(className, "research-and-writing-link--error")}>
                <p>{errorMessage}</p>
                <p>This block won't render during baking</p>
            </div>
        )
    }

    if (linkedDocument) {
        url = `/${linkedDocument.slug}`
        title = linkedDocument.title || title
        authors = linkedDocument.authors || authors
        subtitle = linkedDocument.excerpt || subtitle
        filename = linkedDocument["featured-image"] || filename
    }

    const heading = React.createElement(
        isSmall ? "h3" : "h2",
        { className: isSmall ? "h3-bold" : "h2-bold" },
        title
    )

    return (
        <a
            href={url}
            className={cx("research-and-writing-link", className)}
            target="_blank"
            rel="noopener noreferrer"
        >
            <div>
                {filename && !shouldHideThumbnail ? (
                    <figure>
                        <Image
                            filename={filename}
                            shouldLightbox={false}
                            containerType={isSmall ? "thumbnail" : "default"}
                        />
                    </figure>
                ) : null}
                {heading}
                {subtitle && !shouldHideSubtitle ? (
                    <p className="research-and-writing-link__description body-1-regular">
                        {subtitle}
                    </p>
                ) : null}
                {authors ? (
                    <p className="research-and-writing-link__authors body-3-medium-italic">
                        {formatAuthors({ authors })}
                    </p>
                ) : null}
            </div>
        </a>
    )
}

export function ResearchAndWriting(props: ResearchAndWritingProps) {
    const { primary, secondary, more, rows, className } = props
    return (
        <div className={cx(className, "grid")}>
            <h1
                className="article-block__heading span-cols-12 h1-semibold"
                id={RESEARCH_AND_WRITING_ID}
            >
                Research & Writing
                <a className="deep-link" href={`#${RESEARCH_AND_WRITING_ID}`} />
            </h1>
            <div className="span-cols-12 research-and-writing-row">
                <div className="grid research-and-writing-row__link-container">
                    {primary.map((link, i) => (
                        <ResearchAndWritingLinkContainer
                            className="span-cols-6 span-sm-cols-12"
                            key={i}
                            {...link}
                        />
                    ))}
                    {secondary.map((link, i) => (
                        <ResearchAndWritingLinkContainer
                            key={i}
                            className="span-cols-3 span-md-cols-6 span-sm-cols-12"
                            {...link}
                        />
                    ))}
                </div>
            </div>
            {rows.map((row, i) => (
                <div key={i} className="span-cols-12 research-and-writing-row">
                    <h2 className="h2-bold">{row.heading}</h2>
                    <div className="grid grid-cols-4 grid-lg-cols-3 grid-md-cols-2 research-and-writing-row__link-container">
                        {row.articles.map((link, i) => (
                            <ResearchAndWritingLinkContainer
                                shouldHideSubtitle
                                isSmall
                                className="span-cols-1"
                                key={i}
                                {...link}
                            />
                        ))}
                    </div>
                </div>
            ))}
            {more ? (
                <div className="span-cols-12 research-and-writing-row">
                    <h2 className="h2-bold">{more.heading}</h2>
                    <div className="grid grid-cols-4 grid-lg-cols-3 grid-md-cols-2 research-and-writing-row__link-container">
                        {more.articles.map((link, i) => (
                            <ResearchAndWritingLinkContainer
                                shouldHideThumbnail
                                shouldHideSubtitle
                                isSmall
                                className="span-cols-1"
                                key={i}
                                {...link}
                            />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    )
}
