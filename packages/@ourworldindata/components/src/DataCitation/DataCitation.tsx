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
                        <div className="citation__type">In-line citation</div>
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
                        <div className="citation__type">Full citation</div>
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
