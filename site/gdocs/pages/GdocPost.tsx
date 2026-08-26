import * as _ from "lodash-es"
import cx from "clsx"
import { useIntersectionObserver } from "usehooks-ts"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBoxArchive } from "@fortawesome/free-solid-svg-icons"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import Footnotes from "../components/Footnotes.js"
import {
    OwidGdocPostInterface,
    OwidGdocType,
    EnrichedBlockText,
    getPhraseForArchivalDate,
} from "@ourworldindata/utils"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"
import { OwidGdocHeader } from "../components/OwidGdocHeader.js"
import StickyNav from "../../blocks/StickyNav.js"
import { buildGdocCitation } from "../utils.js"
import { CitationSection } from "../components/CitationSection.js"
import { LicenseSection } from "../components/LicenseSection.js"
import { SidebarTableOfContents } from "../../SidebarTableOfContents.js"
import { useDocumentContext } from "../DocumentContext.js"

const citationDescriptionsByArticleType: Record<
    | OwidGdocType.Article
    | OwidGdocType.TopicPage
    | OwidGdocType.LinearTopicPage
    | OwidGdocType.Fragment
    | OwidGdocType.AboutPage,
    string
> = {
    [OwidGdocType.TopicPage]:
        "Our articles and data visualizations rely on work from many different people and organizations. When citing this topic page, please also cite the underlying data sources. This topic page can be cited as:",
    [OwidGdocType.LinearTopicPage]:
        "Our articles and data visualizations rely on work from many different people and organizations. When citing this topic page, please also cite the underlying data sources. This topic page can be cited as:",
    [OwidGdocType.Article]:
        "Our articles and data visualizations rely on work from many different people and organizations. When citing this article, please also cite the underlying data sources. This article can be cited as:",
    // This case should never occur as Fragments aren't baked and can't be viewed by themselves.
    [OwidGdocType.Fragment]:
        "Our articles and data visualizations rely on work from many different people and organizations. When citing this text, please also cite the underlying data sources. This text can be cited as:",
    // It is unlikely that we would want to cite an about page, but there might be a use case for it.
    [OwidGdocType.AboutPage]:
        "Our articles and data visualizations rely on work from many different people and organizations. When citing this page, please also cite the underlying data sources. This page can be cited as:",
}

type GdocPostProps = Omit<
    OwidGdocPostInterface,
    "contentMd5" | "markdown" | "publicationContext" | "revisionId"
> & {
    isPreviewing?: boolean
}

export function GdocPost({
    content,
    publishedAt,
    slug,
    breadcrumbs,
    manualBreadcrumbs,
    tags,
}: GdocPostProps) {
    const { archiveContext } = useDocumentContext()
    const postType = content.type ?? OwidGdocType.Article
    const citationDescription = citationDescriptionsByArticleType[postType]
    const citationUrl =
        archiveContext?.archiveUrl ?? `${BAKED_BASE_URL}/${slug}`
    const { citationText, bibtex } = buildGdocCitation({
        authors: content.authors,
        title: content.title ?? "",
        publishedAt,
        slug,
        canonicalUrl: citationUrl,
        archivalPhrase: getPhraseForArchivalDate(archiveContext?.archivalDate),
    })
    const hasSidebarToc = content["sidebar-toc"]
    const sidebarHeadings =
        content.toc && content["sidebar-toc-h1-only"]
            ? content.toc.filter((heading) => !heading.isSubheading)
            : content.toc
    const headingVariant = content["heading-variant"] ?? "light"
    const shouldHideSubscribeBanner =
        content["hide-subscribe-banner"] || postType === OwidGdocType.TopicPage
    const isDeprecated =
        postType === OwidGdocType.Article &&
        Boolean(content["deprecation-notice"])
    const stickyNavLinks = content["sticky-nav"]

    return (
        <article
            className={cx(
                "centered-article-container grid grid-cols-12-full-width",
                `centered-article-container--heading-variant-${headingVariant}`,
                // Only add this modifier class when content.type is defined
                {
                    [`centered-article-container--${content.type}`]:
                        content.type,
                }
            )}
        >
            <OwidGdocHeader
                content={content}
                publishedAt={publishedAt}
                breadcrumbs={manualBreadcrumbs ?? breadcrumbs ?? undefined}
                isDeprecated={isDeprecated}
            />
            {isDeprecated && content["deprecation-notice"] && (
                <DeprecationNotice blocks={content["deprecation-notice"]} />
            )}
            {hasSidebarToc && sidebarHeadings ? (
                <SidebarTableOfContents
                    headings={sidebarHeadings}
                    tagName={tags?.[0]?.name}
                />
            ) : null}
            {postType === OwidGdocType.TopicPage && stickyNavLinks?.length ? (
                <nav className="sticky-nav sticky-nav--dark span-cols-14 grid grid-cols-12-full-width">
                    <StickyNav
                        links={stickyNavLinks}
                        className="span-cols-12 col-start-2"
                    />
                </nav>
            ) : null}
            {content.body ? (
                <ArticleBlocks
                    toc={content.toc}
                    blocks={content.body}
                    automaticSubscribeBanner={!shouldHideSubscribeBanner}
                />
            ) : null}
            {content.refs && !_.isEmpty(content.refs.definitions) ? (
                <Footnotes definitions={content.refs.definitions} />
            ) : null}
            {!content["hide-citation"] && (
                <CitationSection
                    citationText={citationText}
                    bibtex={bibtex}
                    description={citationDescription}
                    isDeprecated={isDeprecated}
                />
            )}
            <LicenseSection isDeprecated={isDeprecated} />
        </article>
    )
}

function DeprecationNotice({ blocks }: { blocks: EnrichedBlockText[] }) {
    const { isIntersecting, ref } = useIntersectionObserver({
        // Stops the notice from flashing to full width on page load
        initialIsIntersecting: true,
    })
    return (
        <>
            {/* Non-sticky sentinel element for observing intersection. */}
            <div className="col-start-1 span-cols-14" ref={ref} />
            <div
                className={cx(
                    "deprecation-notice col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12",
                    {
                        "deprecation-notice--sticky": !isIntersecting,
                    }
                )}
            >
                <h4 className="deprecation-notice__heading">
                    <FontAwesomeIcon
                        className="deprecation-notice__icon"
                        icon={faBoxArchive}
                    />
                    This article is outdated
                </h4>
                <ArticleBlocks blocks={blocks} />
            </div>
        </>
    )
}
