import React from "react"
import ReactDOM from "react-dom"
import { ArticleBlocks } from "./ArticleBlocks"
import Footnotes from "./Footnotes"
import {
    OwidArticleBlock,
    OwidArticleType,
    formatDate,
    getArticleFromJSON,
} from "@ourworldindata/utils"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faBook } from "@fortawesome/free-solid-svg-icons/faBook"
import { faCreativeCommons } from "@fortawesome/free-brands-svg-icons/faCreativeCommons"
import { CodeSnippet } from "../blocks/CodeSnippet.js"
import { BAKED_BASE_URL } from "../../settings/clientSettings.js"

export function OwidArticle(props: OwidArticleType) {
    const { content, publishedAt, slug } = props

    const coverStyle = content["cover-image"]
        ? {
              background: `url(${content["cover-image"][0].value.src})`,
              backgroundSize: "cover",
          }
        : content["cover-color"]
        ? { backgroundColor: `var(--${content["cover-color"]})` }
        : {}

    const citationText = `${
        content.byline
    } (${publishedAt?.getFullYear()}) - "${
        content.title
    }". Published online at OurWorldInData.org. Retrieved from: '${`${BAKED_BASE_URL}/${slug}`}' [Online Resource]`

    const bibtex = `@article{owid${slug.replace(/-/g, "")},
    author = {${content.byline}},
    title = {${content.title}},
    journal = {Our World in Data},
    year = {${publishedAt?.getFullYear()}},
    note = {${BAKED_BASE_URL}/${slug}}
}`

    return (
        <article className={"owidArticle"}>
            <div className={"articleCover"} style={coverStyle}></div>
            <div className={"articlePage"}></div>
            <div className={"titling"}>
                <div className={"supertitle"}>{content.supertitle}</div>
                <h1 className={"title"}>{content.title}</h1>
                {content.subtitle ? (
                    <div className={"subtitle"}>{content.subtitle}</div>
                ) : null}
            </div>
            <div className={"meta"}>
                <div>
                    <div className="body-1-regular">
                        By: <a href="/team">{content.byline}</a>
                    </div>
                    <div className="body-3-medium-italic">
                        {content.dateline ||
                            (publishedAt && formatDate(publishedAt))}
                    </div>
                </div>
                <div>
                    <div>
                        <a href="#citation">
                            <FontAwesomeIcon icon={faBook} />
                            Cite this article
                        </a>
                    </div>
                    <div className="body-3-medium">
                        <a href="#licence">
                            <FontAwesomeIcon icon={faCreativeCommons} />
                            Reuse our work freely
                        </a>
                    </div>
                </div>
            </div>

            {content.summary ? (
                <div>
                    <details className={"summary"} open={true}>
                        <summary>Summary</summary>
                        <ArticleBlocks blocks={content.summary} />
                    </details>
                </div>
            ) : null}

            {content.body ? (
                <ArticleBlocks toc={content.toc} blocks={content.body} />
            ) : null}

            {content.refs ? <Footnotes d={content.refs} /> : null}

            {content.citation &&
            content.citation.some(
                (d: OwidArticleBlock) => d.type === "text"
            ) ? (
                <div id="citation">
                    <h3>Cite this work</h3>
                    <p>
                        Our articles and data visualizations rely on work from
                        many different people and organizations. When citing
                        this entry, please also cite the underlying data
                        sources. This entry can be cited as:
                    </p>
                    <div>
                        <CodeSnippet code={citationText} />
                    </div>
                    <p>BibTeX citation</p>
                    <div>
                        <CodeSnippet code={bibtex} />
                    </div>
                </div>
            ) : null}

            <div id="licence">
                <img
                    src="/owid-logo.svg"
                    className="img-raw"
                    alt="Our World in Data logo"
                />
                <h3>Reuse this work freely</h3>

                <p>
                    All visualizations, data, and code produced by Our World in
                    Data are completely open access under the{" "}
                    <a
                        href="https://creativecommons.org/licenses/by/4.0/"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Creative Commons BY license
                    </a>
                    . You have the permission to use, distribute, and reproduce
                    these in any medium, provided the source and authors are
                    credited.
                </p>
                <p>
                    The data produced by third parties and made available by Our
                    World in Data is subject to the license terms from the
                    original third-party authors. We will always indicate the
                    original source of the data in our documentation, so you
                    should always check the license of any such third-party data
                    before use and redistribution.
                </p>
                <p>
                    All of{" "}
                    <a href="/how-to-use-our-world-in-data#how-to-embed-interactive-charts-in-your-article">
                        our charts can be embedded
                    </a>{" "}
                    in any site.
                </p>
            </div>
        </article>
    )
}

export const hydrateOwidArticle = () => {
    const wrapper = document.querySelector("#owid-article-root")
    const props = getArticleFromJSON(window._OWID_ARTICLE_PROPS)
    ReactDOM.hydrate(<OwidArticle {...props} />, wrapper)
}
