import React, { useContext } from "react"
import cx from "classnames"
import {
    EnrichedBlockResearchAndWriting,
    EnrichedBlockResearchAndWritingLink,
    RESEARCH_AND_WRITING_ID,
    slugify,
} from "@ourworldindata/utils"
import { useLinkedDocument } from "../utils.js"
import { formatAuthors } from "../../clientFormatting.js"
import Image from "./Image.js"
import { AttachmentsContext, DocumentContext } from "../OwidGdoc.js"
import {
    DbEnrichedLatestWork,
    RESEARCH_AND_WRITING_DEFAULT_HEADING,
} from "@ourworldindata/types"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"

type ResearchAndWritingProps = {
    className?: string
} & EnrichedBlockResearchAndWriting

function ResearchAndWritingLink(
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

    return (
        <a
            href={url}
            className={cx("research-and-writing-link", className)}
            target="_blank"
            rel="noopener noreferrer"
        >
            {filename && !shouldHideThumbnail ? (
                <figure>
                    <Image
                        filename={filename}
                        shouldLightbox={false}
                        containerType={isSmall ? "thumbnail" : "default"}
                    />
                </figure>
            ) : null}
            <h3
                className={cx("research-and-writing-link__title", {
                    "research-and-writing-link__title--large": !isSmall,
                })}
            >
                {title}
            </h3>
            {subtitle && !shouldHideSubtitle ? (
                <p
                    className={cx("research-and-writing-link__description", {
                        "research-and-writing-link__description--large":
                            !isSmall,
                    })}
                >
                    {subtitle}
                </p>
            ) : null}
            {authors ? (
                <p className="research-and-writing-link__authors body-3-medium-italic">
                    {formatAuthors({ authors })}
                </p>
            ) : null}
        </a>
    )
}

const parseLatestWorkToResearchAndWritingLink = (
    latestWork: DbEnrichedLatestWork
): EnrichedBlockResearchAndWritingLink => {
    return {
        value: {
            ...latestWork,
            url: `${BAKED_BASE_URL}/${latestWork.slug}`,
            filename: latestWork["featured-image"],
        },
    }
}

export function ResearchAndWriting(props: ResearchAndWritingProps) {
    const { heading, primary, secondary, more, rows, latest, className } = props

    const slug = heading ? slugify(heading) : RESEARCH_AND_WRITING_ID

    const { latestWorkLinks } = useContext(AttachmentsContext)
    if (latest && latestWorkLinks) {
        latest.articles = latestWorkLinks.map(
            parseLatestWorkToResearchAndWritingLink
        )
    }

    return (
        <div className={cx(className, "grid")}>
            <h1
                className="article-block__heading span-cols-12 h1-semibold"
                id={slug}
            >
                {heading || RESEARCH_AND_WRITING_DEFAULT_HEADING}
                <a className="deep-link" href={`#${slug}`} />
            </h1>
            <div className="span-cols-12 research-and-writing-row">
                <div className="grid research-and-writing-row__links">
                    {primary.map((link, i) => (
                        <ResearchAndWritingLink
                            className="span-cols-6 span-sm-cols-12"
                            key={i}
                            {...link}
                        />
                    ))}
                    {secondary.map((link, i) => (
                        <ResearchAndWritingLink
                            key={i}
                            className="span-cols-3 span-md-cols-6 span-sm-cols-12"
                            isSmall
                            {...link}
                        />
                    ))}
                </div>
            </div>
            {rows.map((row, i) => (
                <div key={i} className="span-cols-12 research-and-writing-row">
                    <h2 className="h2-bold research-and-writing-row__heading">
                        {row.heading}
                    </h2>
                    <div className="grid grid-cols-4 grid-lg-cols-3 grid-md-cols-2 research-and-writing-row__links">
                        {row.articles.map((link, i) => (
                            <ResearchAndWritingLink
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
                    <h2 className="h2-bold research-and-writing-row__heading">
                        {more.heading}
                    </h2>
                    <div className="grid grid-cols-4 grid-lg-cols-3 grid-md-cols-2 research-and-writing-row__links research-and-writing-row__links--condensed">
                        {more.articles.map((link, i) => (
                            <ResearchAndWritingLink
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
            {latest ? (
                <div className="span-cols-12 research-and-writing-row">
                    <h2 className="h2-bold">
                        {latest.heading || "Latest work"}
                    </h2>
                    <div className="grid grid-cols-4 grid-lg-cols-3 grid-md-cols-2 research-and-writing-row__links">
                        {latest.articles.map((link, i) => (
                            <ResearchAndWritingLink
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
