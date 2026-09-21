import { CITATION_ID } from "@ourworldindata/utils"
import { CodeSnippet } from "@ourworldindata/components"

/** The "Cite this work" section at the foot of a gdoc page */
export function CitationSection({
    citationText,
    bibtex,
    description,
    isDeprecated,
}: {
    citationText: string
    bibtex: string
    description: string
    isDeprecated?: boolean
}) {
    return (
        <section
            id={CITATION_ID}
            className="grid grid-cols-12-full-width col-start-1 col-end-limit no-dividers"
        >
            <div className="col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                <h3 className={isDeprecated ? "align-left" : "align-center"}>
                    Cite this work
                </h3>
                {isDeprecated && (
                    <p className="citation-deprecated-notice">
                        <span className="citation-deprecated-notice__highlight">
                            This content is outdated
                        </span>
                        , but if you would still like to use it, here is how to
                        cite it:
                        <br />
                    </p>
                )}
                <p>{description}</p>
                <div>
                    <CodeSnippet code={citationText} />
                </div>
                <p>BibTeX citation</p>
                <div>
                    <CodeSnippet code={bibtex} />
                </div>
            </div>
        </section>
    )
}
