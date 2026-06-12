import { ExpandableToggle } from "../ExpandableToggle/ExpandableToggle.js"
import { CodeSnippet } from "../CodeSnippet/CodeSnippet.js"

export const ExpandableDataCitation = (props: {
    citationShort: string
    citationLong: string
}) => {
    return (
        <div className="expandable-data-citation">
            {props.citationShort && (
                <ExpandableToggle
                    label="How should I cite this data in a news article?"
                    content={
                        <div className="data-citation__item">
                            <p className="citation__paragraph">
                                <div className="citation__type">
                                    In-line citation
                                </div>
                                If you have limited space (e.g. in data
                                visualizations), you can use this abbreviated
                                in-line citation:
                            </p>
                            <CodeSnippet
                                code={props.citationShort}
                                theme="light"
                                useMarkdown={true}
                            />
                        </div>
                    }
                />
            )}
            {props.citationLong && (
                <ExpandableToggle
                    label="How should I cite this in an academic article or report?"
                    content={
                        <div className="data-citation__item">
                            <p className="citation__paragraph">
                                <div className="citation__type">
                                    Full citation
                                </div>
                            </p>
                            <CodeSnippet
                                code={props.citationLong}
                                theme="light"
                                useMarkdown={true}
                            />
                        </div>
                    }
                />
            )}
        </div>
    )
}
