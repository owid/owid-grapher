import React from "react"
import { CodeSnippet } from "../CodeSnippet/CodeSnippet.js"

export const DataCitation = (props: {
    citationShort: string
    citationLong: string
}) => {
    return (
        <>
            {props.citationShort && (
                <>
                    <p className="citation__paragraph">
                        <span className="citation__type">In-line citation</span>
                        <br />
                        If you have limited space (e.g. in data visualizations,
                        on social media), you can use this abbreviated in-line
                        citation:
                    </p>
                    <CodeSnippet
                        code={props.citationShort}
                        theme="light"
                        useMarkdown={true}
                    />
                </>
            )}
            {props.citationLong && (
                <>
                    <p className="citation__paragraph">
                        <span className="citation__type">Full citation</span>
                    </p>
                    <CodeSnippet
                        code={props.citationLong}
                        theme="light"
                        useMarkdown={true}
                    />
                </>
            )}
        </>
    )
}
