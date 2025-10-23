import * as _ from "lodash-es"
import { ArticleBlocks } from "../components/ArticleBlocks.js"
import Footnotes from "../components/Footnotes.js"
import {
    OwidGdocProfileInterface,
    CITATION_ID,
    LICENSE_ID,
    formatAuthorsForBibtex,
} from "@ourworldindata/utils"
import { CodeSnippet } from "@ourworldindata/components"
import { BAKED_BASE_URL } from "../../../settings/clientSettings.js"
import { getShortPageCitation } from "../utils.js"
import { Byline } from "../components/Byline.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faBook } from "@fortawesome/free-solid-svg-icons"
import { faCreativeCommons } from "@fortawesome/free-brands-svg-icons"
import { TableOfContents } from "../../TableOfContents.js"

type ProfileProps = Omit<
    OwidGdocProfileInterface,
    "markdown" | "publicationContext" | "revisionId"
> & {
    isPreviewing?: boolean
}

export function Profile({ content, publishedAt, slug }: ProfileProps) {
    const hasSidebarToc = content["sidebar-toc"]

    const shortPageCitation = getShortPageCitation(
        content.authors,
        content.title ?? "",
        publishedAt
    )
    const citationText = `${shortPageCitation} Published online at OurWorldinData.org. Retrieved from: '${`${BAKED_BASE_URL}/${slug}`}' [Online Resource]`

    const bibtex = `@article{owid-${slug.replace(/\//g, "-")},
    author = {${formatAuthorsForBibtex(content.authors)}},
    title = {${content.title}},
    journal = {Our World in Data},
    year = {${publishedAt?.getFullYear()}},
    note = {${BAKED_BASE_URL}/${slug}}
}`

    return (
        <article className="centered-article-container grid grid-cols-12-full-width centered-article-container--profile">
            <header className="topic-page-header grid span-cols-14 grid-cols-12-full-width">
                <h1 className="display-2-semibold col-start-2 span-cols-8 col-sm-start-2 span-sm-cols-12">
                    {content.title}
                </h1>
                {content.subtitle && (
                    <p className="topic-page-header__subtitle body-1-regular col-start-2 span-cols-8 col-sm-start-2 span-sm-cols-12">
                        {content.subtitle}
                    </p>
                )}
                {content.authors.length > 0 && (
                    <p className="topic-page-header__byline col-start-2 span-cols-8 col-sm-start-2 span-sm-cols-12">
                        <Byline names={content.authors} />
                    </p>
                )}
                <div className="topic-page-header__cta-buttons col-start-2 span-cols-8 col-sm-start-2 span-sm-cols-12">
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
            {hasSidebarToc && content.toc ? (
                <TableOfContents
                    headings={content.toc}
                    headingLevels={{ primary: 1, secondary: 2 }}
                    pageTitle={content.title || ""}
                />
            ) : null}
            {content.body ? <ArticleBlocks blocks={content.body} /> : null}
            {content.refs && !_.isEmpty(content.refs.definitions) ? (
                <Footnotes definitions={content.refs.definitions} />
            ) : null}
            <section
                id={CITATION_ID}
                className="grid grid-cols-12-full-width col-start-1 col-end-limit"
            >
                <div className="col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                    <h3 className="align-center">Cite this work</h3>
                    <p>
                        Our articles and data visualizations rely on work from
                        many different people and organizations. When citing
                        this profile page, please also cite the underlying data
                        sources. This profile page can be cited as:
                    </p>
                    <div>
                        <CodeSnippet code={citationText} />
                    </div>
                    <p>BibTeX citation</p>
                    <div>
                        <CodeSnippet code={bibtex} />
                    </div>
                </div>
            </section>
            <section
                id={LICENSE_ID}
                className="grid grid-cols-12-full-width col-start-1 col-end-limit"
            >
                <div className="col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                    <img
                        src="/owid-logo.svg"
                        alt="Our World in Data logo"
                        loading="lazy"
                        width={104}
                        height={57}
                    />
                    <h3>Reuse this work freely</h3>
                    <p>
                        All visualizations, data, and code produced by Our World
                        in Data are completely open access under the{" "}
                        <a
                            href="https://creativecommons.org/licenses/by/4.0/"
                            target="_blank"
                            rel="noopener"
                        >
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
                    <p>
                        All of <a href="https://github.com/owid">our charts</a>{" "}
                        can be embedded in any site.
                    </p>
                </div>
            </section>
        </article>
    )
}
