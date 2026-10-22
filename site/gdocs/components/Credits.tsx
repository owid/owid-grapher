import { CREDITS_ID, EnrichedBlockText } from "@ourworldindata/types"
import { Byline } from "./Byline.js"
import Paragraph from "./Paragraph.js"

export default function Credits({
    authors,
    authorRoles,
    contributors = [],
    contributorRoles,
    acknowledgements = [],
}: {
    authors: string[]
    authorRoles?: Record<string, string>
    contributors?: string[]
    contributorRoles?: Record<string, string>
    acknowledgements?: EnrichedBlockText[]
}) {
    if (contributors.length === 0 && acknowledgements.length === 0) return null

    return (
        <section
            id={CREDITS_ID}
            className="credits span-cols-14 grid grid-cols-12-full-width"
        >
            <hr className="credits__divider col-start-2 span-cols-12" />
            <div className="credits__body col-start-4 span-cols-8 col-md-start-3 span-md-cols-10 col-sm-start-2 span-sm-cols-12">
                <h3 className="credits__heading">
                    Contributors & acknowledgements
                </h3>
                {authors.length > 0 && (
                    <p className="credits__paragraph">
                        <Byline authors={authors} authorRoles={authorRoles} />.
                    </p>
                )}
                {contributors.length > 0 && (
                    <p className="credits__paragraph">
                        <Byline
                            authors={contributors}
                            authorRoles={contributorRoles}
                            prefix="With contributions from "
                        />
                        .
                    </p>
                )}
                {acknowledgements.map((block, index) => (
                    <Paragraph
                        key={index}
                        d={block}
                        className="credits__paragraph"
                    />
                ))}
            </div>
        </section>
    )
}
