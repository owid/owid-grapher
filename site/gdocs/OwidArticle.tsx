import React from "react"
import ReactDOM from "react-dom"
import { ArticleBlocks } from "./ArticleBlocks"
import Footnotes from "./Footnotes"
import {
    OwidArticleBlock,
    OwidArticleProps,
    OwidArticleType,
} from "../../clientUtils/owidTypes.js"
import { formatDate, getArticleFromJSON } from "../../clientUtils/Util.js"

interface OwidArticleErrorBoundaryProps {
    article: OwidArticleType
    isPreviewing: boolean
    children?: React.ReactNode
}

class OwidArticleErrorBoundary extends React.Component<
    OwidArticleErrorBoundaryProps,
    { hasError: boolean; error: Error | undefined },
    Record<string, never>
> {
    constructor(props: OwidArticleErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false, error: undefined }
    }

    static getDerivedStateFromError(error: Error) {
        // Update state so the next render will show the fallback UI.

        return { hasError: true, error: error }
    }
    componentDidCatch(error: any, errorInfo: any) {
        // You can also log the error to an error reporting service
        // console.error(error, errorInfo)
    }
    render() {
        if (this.state.hasError && this.props.isPreviewing) {
            // You can render any custom fallback UI

            return (
                <div>
                    <h3>There is an error in the ArchieML JSON structure</h3>
                    <p>The error message was:</p>
                    <pre>
                        {this.state.error?.message ??
                            "error message not provided - please look in the dev console (F12)"}
                    </pre>
                    <p>
                        Check below that the JSON structure looks correct.
                        Verify that e.g. chart elements have a url value etc.
                    </p>
                    <pre>{JSON.stringify(this.props.article, null, 2)}</pre>
                </div>
            )
        }
        return this.props.children
    }
}
export function OwidArticle(props: OwidArticleProps) {
    const { content, publishedAt } = props.article

    const coverStyle = content["cover-image"]
        ? {
              background: `url(${content["cover-image"][0].value.src})`,
              backgroundSize: "cover",
          }
        : {}

    const element: JSX.Element = (
        <OwidArticleErrorBoundary
            article={props.article}
            isPreviewing={props.isPreviewing}
        >
            <article className={"owidArticle"}>
                <div className={"articleCover"} style={coverStyle}></div>
                <div className={"articlePage"}></div>
                <h1 className={"title"}>{content.title}</h1>
                <h2 className={"subtitle"}>{content.subtitle}</h2>
                <div className={"bylineContainer"}>
                    <div>
                        By: <div className={"byline"}>{content.byline}</div>
                    </div>
                    <div className={"dateline"}>
                        {content.dateline ||
                            (publishedAt && formatDate(publishedAt))}
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

                {content.body ? <ArticleBlocks blocks={content.body} /> : null}

                {content.refs ? <Footnotes d={content.refs} /> : null}

                {content.citation &&
                content.citation.some(
                    (d: OwidArticleBlock) => d.type === "text"
                ) ? (
                    <div>
                        <h3>Please cite this article as:</h3>
                        <pre>
                            <code>
                                {content.citation.map((d: OwidArticleBlock) => {
                                    if (d.type === "text") {
                                        return d.value
                                    } else {
                                        return ""
                                    }
                                })}
                            </code>
                        </pre>
                    </div>
                ) : null}
            </article>
        </OwidArticleErrorBoundary>
    )

    return element
}

export const hydrateOwidArticle = () => {
    const wrapper = document.querySelector("#owid-article-root")
    const props = getArticleFromJSON(window._OWID_ARTICLE_PROPS)
    // TODO: how should isPreviewing supposed to be set in the hydration case?
    ReactDOM.hydrate(
        <OwidArticle article={props} isPreviewing={false} />,
        wrapper
    )
}
