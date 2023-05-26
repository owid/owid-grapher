import React from "react"
import {
    EnrichedBlockResearchAndWriting,
    EnrichedBlockResearchAndWritingLink,
} from "@ourworldindata/utils"
import { useLinkedDocument } from "../gdocs/utils.js"

type ResearchAndWritingProps = {
    className?: string
} & EnrichedBlockResearchAndWriting

function ResearchAndWritingLinkContainer(
    props: EnrichedBlockResearchAndWritingLink & { className?: string }
) {
    const {
        value: { url, title },
        parseErrors,
    } = props
    const linkedDocument = useLinkedDocument(url)
    if (parseErrors.length) {
        return <div>Error!</div>
    }
    if (linkedDocument) {
        return <div>Linked document</div>
    }
    return (
        <div>
            <h3>{title}</h3>
            <p>${url}</p>
        </div>
    )
}

export function ResearchAndWriting(props: ResearchAndWritingProps) {
    const { primary, secondary, more, rows, className } = props
    return (
        <div className={className}>
            <h2>Research & writing</h2>
            <ResearchAndWritingLinkContainer {...primary} />
            <ResearchAndWritingLinkContainer {...secondary} />
            <div>
                {more.map((link, i) => (
                    <ResearchAndWritingLinkContainer key={i} {...link} />
                ))}
            </div>
            {rows.map((row, i) => (
                <div key={i}>
                    <h4>{row.heading}</h4>
                    <div>
                        {row.articles.map((link, i) => (
                            <ResearchAndWritingLinkContainer
                                key={i}
                                {...link}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}
