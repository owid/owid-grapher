import * as _ from "lodash-es"
import cx from "clsx"
import { useIntersectionObserver } from "usehooks-ts"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBoxArchive } from "@fortawesome/free-solid-svg-icons"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import { BespokeVizLightbox } from "../components/BespokeVizLightbox.js"
import Footnotes from "../components/Footnotes.js"
import {
    OwidGdocPostInterface,
    CITATION_ID,
    LICENSE_ID,
    OwidGdocType,
    formatAuthorsForBibtex,
    EnrichedBlockText,
    OwidEnrichedGdocBlock,
    getPhraseForArchivalDate,
} from "@ourworldindata/utils"
import { CodeSnippet } from "@ourworldindata/components"
import { BAKED_BASE_URL, IS_ARCHIVE } from "../../../settings/clientSettings.js"
import { OwidGdocHeader } from "../components/OwidGdocHeader.js"
import StickyNav from "../../blocks/StickyNav.js"
import { getShortPageCitation } from "../utils.js"
import { TableOfContents } from "../../TableOfContents.js"
import { useDocumentContext } from "../DocumentContext.js"
import { PROD_URL } from "../../SiteConstants.js"

const BASE_URL = IS_ARCHIVE ? PROD_URL : ""

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
}: GdocPostProps) {
    const { archiveContext } = useDocumentContext()
    const postType = content.type ?? OwidGdocType.Article
    const citationDescription = citationDescriptionsByArticleType[postType]
    const shortPageCitation = getShortPageCitation(
        content.authors,
        content.title ?? "",
        publishedAt
    )
    const citationUrl =
        archiveContext?.archiveUrl ?? `${BAKED_BASE_URL}/${slug}`
    const archivalPhrase = getPhraseForArchivalDate(
        archiveContext?.archivalDate
    )
    const citationText = `${shortPageCitation} Published online at OurWorldinData.org. Retrieved from: '${citationUrl}' [Online Resource]${archivalPhrase ? ` ${archivalPhrase}` : ""}`
    const hasSidebarToc = content["sidebar-toc"]
    const headingVariant = content["heading-variant"] ?? "light"
    // Opt-in viz-forward chrome. When the article front-matter sets
    // `layout: bespoke-viz`, we render a two-column layout (commentary left,
    // bespoke-component viz in a sticky right column). Everything below is
    // gated behind this flag so normal articles render exactly as before.
    const isBespokeViz = content.layout === "bespoke-viz"
    const shouldHideSubscribeBanner =
        content["hide-subscribe-banner"] || postType === OwidGdocType.TopicPage
    const isDeprecated =
        postType === OwidGdocType.Article &&
        Boolean(content["deprecation-notice"])
    const bibtex = `@article{owid-${slug.replace(/\//g, "-")},
    author = {${formatAuthorsForBibtex(content.authors)}},
    title = {${content.title}},
    journal = {Our World in Data},
    year = {${publishedAt?.getFullYear()}},
    note = {${citationUrl}}
}`

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
                    "centered-article-container--bespoke-viz": isBespokeViz,
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
            {hasSidebarToc && content.toc ? (
                <TableOfContents
                    headings={content.toc}
                    headingLevels={{ primary: 1, secondary: 2 }}
                    pageTitle={content.title || ""}
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
            {content.body && isBespokeViz ? (
                <BespokeVizBody blocks={content.body} toc={content.toc} />
            ) : content.body ? (
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
                <section
                    id={CITATION_ID}
                    className="grid grid-cols-12-full-width col-start-1 col-end-limit no-dividers"
                >
                    <div className="col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                        <h3
                            className={
                                isDeprecated ? "align-left" : "align-center"
                            }
                        >
                            Cite this work
                        </h3>
                        {isDeprecated && (
                            <p className="citation-deprecated-notice">
                                <span className="citation-deprecated-notice__highlight">
                                    This content is outdated
                                </span>
                                , but if you would still like to use it, here is
                                how to cite it:
                                <br />
                            </p>
                        )}
                        <p>{citationDescription}</p>
                        <div>
                            <CodeSnippet code={citationText} />
                        </div>
                        <p>BibTeX citation</p>
                        <div>
                            <CodeSnippet code={bibtex} />
                        </div>
                    </div>
                </section>
            )}
            <section
                id={LICENSE_ID}
                className="grid grid-cols-12-full-width col-start-1 col-end-limit"
            >
                <div className="col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                    {!isDeprecated && (
                        <>
                            <img
                                src="/owid-logo.svg"
                                alt="Our World in Data logo"
                                loading="lazy"
                                width={104}
                                height={57}
                            />
                            <h3>Reuse this work freely</h3>
                        </>
                    )}

                    <p>
                        All visualizations, data, and articles produced by Our
                        World in Data are completely open access under the{" "}
                        <a href="https://creativecommons.org/licenses/by/4.0/">
                            Creative Commons BY license
                        </a>
                        . You have the permission to use, distribute, and
                        reproduce these in any medium, provided the source and
                        authors are credited.
                    </p>
                    <p>
                        The data produced by third parties and made available by
                        Our World in Data is subject to the license terms from
                        the original third-party authors. We will always
                        indicate the original source of the data in our
                        documentation, so you should always check the license of
                        any such third-party data before use and redistribution.
                    </p>
                    {!isDeprecated && (
                        <p>
                            All of{" "}
                            <a
                                href={`${BASE_URL}/faqs#how-can-i-embed-one-of-your-interactive-charts-in-my-website`}
                            >
                                our charts can be embedded
                            </a>{" "}
                            in any site.
                        </p>
                    )}
                </div>
            </section>
        </article>
    )
}

/**
 * Body renderer for the `layout: bespoke-viz` variant.
 *
 * Splits the article body into two columns: all the regular text/commentary
 * blocks go in the (narrower) left column, and any `bespoke-component` viz
 * block(s) go in the (wider) sticky right column. The actual grid sizing,
 * stickiness and gutters live in centered-article.scss, scoped under the
 * `.centered-article-container--bespoke-viz` modifier.
 *
 * The bespoke-component renders inline at the right-column width — it already
 * reflows to its container via a ResizeObserver, so no extra sizing is needed.
 */
function BespokeVizBody({
    blocks,
    toc,
}: {
    blocks: OwidEnrichedGdocBlock[]
    toc?: GdocPostProps["content"]["toc"]
}) {
    const vizBlocks = blocks.filter(
        (block) => block.type === "bespoke-component"
    )
    const commentaryBlocks = blocks.filter(
        (block) => block.type !== "bespoke-component"
    )

    return (
        <div className="bespoke-viz-layout span-cols-14">
            <div className="bespoke-viz-layout__commentary">
                {/* No automatic subscribe banner here: the commentary column
                    reads as secondary meta-commentary, kept deliberately clean. */}
                <ArticleBlocks blocks={commentaryBlocks} toc={toc} />
            </div>
            {/* The lightbox controller renders the viz column and owns the
                hover-to-expand behaviour (stage 2). The viz instance stays
                mounted and is moved imperatively, never remounted. */}
            <BespokeVizLightbox blocks={vizBlocks} toc={toc} />
        </div>
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
