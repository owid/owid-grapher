import React from "react"
import { CodeSnippet } from "../CodeSnippet/CodeSnippet.js"

export const DataCitation = (props: {
    citationShort: string
    citationLong: string
}) => {
    return (
        <div className="data-citation">
            {props.citationShort && (
                <div className="data-citation__item">
                    <p className="citation__paragraph">
                        <span className="citation__type">In-line citation</span>
                        If you have limited space (e.g. in data visualizations),
                        you can use this abbreviated in-line citation:
                    </p>
                    <CodeSnippet
                        code={props.citationShort}
                        theme="light"
                        useMarkdown={true}
                    />
                </div>
            )}
            {props.citationLong && (
                <div className="data-citation__item">
                    <p className="citation__paragraph">
                        <span className="citation__type">Full citation</span>
                    </p>
                    <CodeSnippet
                        code={props.citationLong}
                        theme="light"
                        useMarkdown={true}
                    />
                </div>
            )}
        </div>
    )
}
