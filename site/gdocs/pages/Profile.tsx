import * as _ from "lodash-es"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import Footnotes from "../components/Footnotes.js"
import {
    OwidGdocProfileInterface,
    CITATION_ID,
    LICENSE_ID,
} from "@ourworldindata/utils"
import { getCanonicalUrl } from "@ourworldindata/components"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"
import { OwidGdocType } from "@ourworldindata/types"
import { buildGdocCitation } from "../utils.js"
import { CitationSection } from "../components/CitationSection.js"
import { LicenseSection } from "../components/LicenseSection.js"
import { Byline } from "../components/Byline.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBook } from "@fortawesome/free-solid-svg-icons"
import { faCreativeCommons } from "@fortawesome/free-brands-svg-icons"
import { SidebarTableOfContents } from "../../SidebarTableOfContents.js"

const CITATION_DESCRIPTION =
    "Our articles and data visualizations rely on work from many different people and organizations. When citing this profile page, please also cite the underlying data sources. This profile page can be cited as:"

type ProfileProps = Omit<
    OwidGdocProfileInterface,
    "markdown" | "publicationContext" | "revisionId"
> & {
    isPreviewing?: boolean
}

export function Profile({ content, publishedAt, slug, tags }: ProfileProps) {
    const hasSidebarToc = content["sidebar-toc"]
    const sidebarHeadings =
        content.toc && content["sidebar-toc-h1-only"]
            ? content.toc.filter((heading) => !heading.isSubheading)
            : content.toc
    const instantiatedEntity = content.instantiatedEntity

    const { citationText, bibtex } = buildGdocCitation({
        authors: content.authors,
        title: content.title ?? "",
        publishedAt,
        slug,
        canonicalUrl: getCanonicalUrl(BAKED_BASE_URL, {
            slug,
            content: { type: OwidGdocType.Profile },
        }),
    })

    return (
        <article className="centered-article-container grid grid-cols-12-full-width centered-article-container--profile">
            <header className="topic-page-header grid span-cols-14 grid-cols-12-full-width">
                <div className="profile-title col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2">
                    <div className="profile-title__container">
                        {instantiatedEntity?.isCountry && (
                            <img
                                className="profile-title__flag"
                                src={`/images/flags/${instantiatedEntity.code}.svg`}
                                alt=""
                                width={64}
                                height={48}
                            />
                        )}
                        <span className="profile-title__label h5-black-caps">
                            {instantiatedEntity?.name}{" "}
                            {instantiatedEntity?.isCountry
                                ? "Country Profile"
                                : "Region Profile"}
                        </span>
                    </div>
                    <h1 className="display-2-semibold">{content.title}</h1>
                </div>
                {content.subtitle && (
                    <p className="topic-page-header__subtitle body-1-regular col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2">
                        {content.subtitle}
                    </p>
                )}
                {content.authors.length > 0 && (
                    <p className="topic-page-header__byline col-start-5 span-cols-6 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2">
                        <Byline names={content.authors} />
                    </p>
                )}
                <div className="topic-page-header__cta-buttons col-start-11 span-cols-3 col-md-start-3 span-md-cols-10 span-sm-cols-12 col-sm-start-2">
                    <a href={`#${CITATION_ID}`}>
                        <FontAwesomeIcon icon={faBook} />
                        Cite this work
                    </a>
                    <a href={`#${LICENSE_ID}`}>
                        <FontAwesomeIcon icon={faCreativeCommons} />
                        Reuse this work
                    </a>
                </div>
            </header>
            {hasSidebarToc && sidebarHeadings ? (
                <SidebarTableOfContents
                    headings={sidebarHeadings}
                    tagName={tags?.[0]?.name}
                />
            ) : null}
            {content.body ? <ArticleBlocks blocks={content.body} /> : null}
            {content.refs && !_.isEmpty(content.refs.definitions) ? (
                <Footnotes definitions={content.refs.definitions} />
            ) : null}
            <CitationSection
                citationText={citationText}
                bibtex={bibtex}
                description={CITATION_DESCRIPTION}
            />
            <LicenseSection />
        </article>
    )
}
