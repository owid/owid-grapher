import React from "react"
import { EnrichedBlockRecirc } from "@ourworldindata/utils"
import { renderSpan, useLinkedDocument } from "./utils.js"
import { formatAuthors } from "../clientFormatting.js"

function RecircItem({ url }: { url: string }) {
    const { linkedDocument } = useLinkedDocument(url)
    if (!linkedDocument) return null

    return (
        <aside className="recirc-article-container">
            <h3 className="h3-bold">
                <a href={`/${linkedDocument.slug}`}>
                    {linkedDocument.content.title}
                </a>
            </h3>
            {linkedDocument.content.authors ? (
                <div className="body-3-medium-italic">
                    {formatAuthors({
                        authors: linkedDocument.content.authors,
                    })}
                </div>
            ) : null}
        </aside>
    )
}

export default function Recirc({
    d,
    className = "",
}: {
    d: EnrichedBlockRecirc
    className?: string
}) {
    return (
        <div className={className}>
            <div className="recirc-content">
                <span className="recirc-content__heading overline-black-caps">
                    {renderSpan(d.title)}
                </span>
                {d.links.map(({ url }) => {
                    return <RecircItem url={url} key={url} />
                })}
            </div>
        </div>
    )
}
