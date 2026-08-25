import * as _ from "lodash-es"
import cx from "clsx"
import {
    EnrichedBlockBespokeComponent,
    OwidEnrichedGdocBlock,
    OwidGdocFeaturedVizContent,
    OwidGdocFeaturedVizInterface,
    OwidGdocType,
} from "@ourworldindata/types"
import { formatDate } from "@ourworldindata/utils"
import { getCanonicalUrl } from "@ourworldindata/components"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import { getLayout } from "../components/layout.js"
import { BespokeComponent } from "../components/BespokeComponent.js"
import { Byline } from "../components/Byline.js"
import { CitationSection } from "../components/CitationSection.js"
import { LicenseSection } from "../components/LicenseSection.js"
import Footnotes from "../components/Footnotes.js"
import { buildGdocCitation } from "../utils.js"

const CITATION_DESCRIPTION =
    "Our articles and data visualizations rely on work from many different people and organizations. When citing this page, please also cite the underlying data sources. This page can be cited as:"

type FeaturedVizProps = Omit<
    OwidGdocFeaturedVizInterface,
    "contentMd5" | "markdown" | "publicationContext" | "revisionId"
> & {
    isPreviewing?: boolean
}

export function FeaturedViz({ content, publishedAt, slug }: FeaturedVizProps) {
    const { before, hero, after } = splitFeaturedVizBody(content.body)

    const { citationText, bibtex } = buildGdocCitation({
        authors: content.authors,
        title: content.title,
        publishedAt,
        slug,
        canonicalUrl: getCanonicalUrl(BAKED_BASE_URL, {
            slug,
            content: { type: OwidGdocType.FeaturedViz },
        }),
    })

    return (
        <article className="centered-article-container centered-article-container--featured-viz grid grid-cols-12-full-width">
            <FeaturedVizHeader content={content} publishedAt={publishedAt} />
            {before.length > 0 && (
                <hr
                    className={cx(
                        "featured-viz-divider",
                        getLayout("horizontal-rule")
                    )}
                />
            )}
            <ArticleBlocks blocks={before} />
            {hero && <FeaturedVizHero block={hero} />}
            <ArticleBlocks blocks={after} />
            {content.refs && !_.isEmpty(content.refs.definitions) ? (
                <Footnotes definitions={content.refs.definitions} />
            ) : null}
            {!content["hide-citation"] && (
                <CitationSection
                    citationText={citationText}
                    bibtex={bibtex}
                    description={CITATION_DESCRIPTION}
                />
            )}
            <LicenseSection />
        </article>
    )
}

function FeaturedVizHeader({
    content,
    publishedAt,
}: {
    content: OwidGdocFeaturedVizContent
    publishedAt: Date | null
}) {
    return (
        <header className="featured-viz-header grid span-cols-14 grid-cols-12-full-width">
            <h1 className="featured-viz-header__title col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                {content.title}
            </h1>
            {content.subtitle ? (
                <p className="featured-viz-header__subtitle col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                    {content.subtitle}
                </p>
            ) : null}
            {content.authors.length > 0 && (
                <p className="featured-viz-header__byline col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                    <Byline
                        names={content.authors}
                        authorRoles={content.authorRoles}
                    />
                </p>
            )}
            <p
                className="featured-viz-header__dateline col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12"
                suppressHydrationWarning={true}
            >
                {content.dateline || (publishedAt && formatDate(publishedAt))}
            </p>
        </header>
    )
}

/** The page's featured viz: a full-bleed band behind the bespoke component. */
function FeaturedVizHero({ block }: { block: EnrichedBlockBespokeComponent }) {
    return (
        <div className="featured-viz-hero span-cols-14 grid grid-cols-12-full-width">
            <BespokeComponent
                className={cx(
                    "featured-viz-hero__viz",
                    getLayout(`bespoke-component--${block.size}`)
                )}
                block={block}
            />
        </div>
    )
}

interface FeaturedVizBodySplit {
    /** Blocks before the featured viz, usually a short intro paragraph. */
    before: OwidEnrichedGdocBlock[]
    /** The featured viz itself, or undefined if the body has none. */
    hero: EnrichedBlockBespokeComponent | undefined
    /** Blocks after the featured viz. */
    after: OwidEnrichedGdocBlock[]
}

/**
 * Split the body around its featured viz, so the page can render that one
 * block on its own full-bleed band
 */
function splitFeaturedVizBody(
    body: OwidEnrichedGdocBlock[] = []
): FeaturedVizBodySplit {
    // Find the first bespoke-component block at the top level
    const heroIndex = body.findIndex(
        (block) => block.type === "bespoke-component"
    )
    if (heroIndex === -1) return { before: body, hero: undefined, after: [] }

    return {
        before: body.slice(0, heroIndex),
        hero: body[heroIndex] as EnrichedBlockBespokeComponent,
        after: body.slice(heroIndex + 1),
    }
}
