import React, { useContext } from "react"
import cx from "classnames"
import {
    EnrichedBlockResearchAndWriting,
    EnrichedBlockResearchAndWritingLink,
    RESEARCH_AND_WRITING_ID,
    formatDate,
    slugify,
} from "@ourworldindata/utils"
import { useLinkedDocument } from "../utils.js"
import { formatAuthors } from "../../clientFormatting.js"
import Image from "./Image.js"
import { AttachmentsContext, DocumentContext } from "../OwidGdoc.js"
import {
    DEFAULT_GDOC_FEATURED_IMAGE,
    DbEnrichedLatestWork,
    RESEARCH_AND_WRITING_DEFAULT_HEADING,
} from "@ourworldindata/types"

type ResearchAndWritingProps = {
    className?: string
} & EnrichedBlockResearchAndWriting

function ResearchAndWritingLink(
    props: EnrichedBlockResearchAndWritingLink & {
        className?: string
        isSmall?: boolean
        shouldHideThumbnail?: boolean
        shouldHideThumbnailSm?: boolean
        shouldHideSubtitle?: boolean
    }
) {
    let {
        value: {
            url,
            title,
            subtitle,
            authors,
            filename = DEFAULT_GDOC_FEATURED_IMAGE,
            date,
        },
        shouldHideThumbnail = false,
        shouldHideThumbnailSm = false,
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
            className={cx(
                "research-and-writing-link",
                {
                    "research-and-writing-link--hide-thumbnail-sm":
                        shouldHideThumbnailSm,
                },
                className
            )}
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
            {date ? (
                <p className="research-and-writing-link__date">
                    {formatDate(new Date(date))}
                </p>
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
            url: `/${latestWork.slug}`, // we might want to use a version of getCanonicalUrl here if we start linking to types other than OwidGdocType.Article
            filename: latestWork["featured-image"] || undefined,
            date: latestWork.publishedAt || undefined,
            subtitle: latestWork.subtitle || undefined,
        },
    }
}

export function ResearchAndWriting(props: ResearchAndWritingProps) {
    const { heading, primary, secondary, more, rows, latest, className } = props

    const slug = heading ? slugify(heading) : RESEARCH_AND_WRITING_ID

    // Get the URLs from the links of the featured work section. These will be
    // excluded from the latest work section below to avoid duplication.
    const primarySecondaryUrls = [...primary, ...secondary].map(
        (link) => link.value.url
    )
    const { latestWorkLinks } = useContext(AttachmentsContext)
    // There might be latestWorkLinks available but we only want to show them if
    // a {.latest} block has been added
    if (latest && latestWorkLinks) {
        latest.articles = latestWorkLinks
            // We want to filter out the primary and secondary links (aka.
            // featured work links) from the latest work section to avoid
            // duplication. Only featured links pointing to gdocs are
            // considered.
            .filter(
                (link) =>
                    !primarySecondaryUrls.includes(
                        `https://docs.google.com/document/d/${link.id}/edit`
                    )
            )
            .map(parseLatestWorkToResearchAndWritingLink)
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
                <div className="grid research-and-writing-row__links research-and-writing-row__links--overflow">
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
                    <div className="grid grid-cols-4 grid-lg-cols-3 grid-md-cols-2 research-and-writing-row__links research-and-writing-row__links--overflow">
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
                    <div className="grid grid-cols-4 grid-lg-cols-3 grid-md-cols-2 research-and-writing-row__links research-and-writing-row__links--condensed-sm research-and-writing-row__links--condensed research-and-writing-row__links--overflow">
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
            {latest?.articles?.length ? (
                <div className="span-cols-12 research-and-writing-row">
                    <h2 className="h2-bold research-and-writing-row__heading">
                        {latest.heading || "Latest work"}
                    </h2>
                    <div className="grid grid-cols-4 grid-lg-cols-3 grid-md-cols-2 grid-sm-cols-1 research-and-writing-row__links research-and-writing-row__links--condensed-sm">
                        {latest.articles.map((link, i) => (
                            <ResearchAndWritingLink
                                isSmall
                                shouldHideThumbnailSm
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
