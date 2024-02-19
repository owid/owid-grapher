import { EnrichedBlockPillRow } from "@ourworldindata/types"
import React, { useContext } from "react"
import { useLinkedDocument } from "../utils.js"
import { DocumentContext } from "../OwidGdoc.js"

function Pill(props: { text?: string; url: string }) {
    const { linkedDocument, errorMessage } = useLinkedDocument(props.url)
    const { isPreviewing } = useContext(DocumentContext)
    const url = linkedDocument ? `/${linkedDocument.slug}` : props.url
    const text = props.text ?? linkedDocument?.title

    if (isPreviewing) {
        if (errorMessage || !text || !url) {
            return (
                <li className="article-block__pill article-block__pill--error">
                    {errorMessage}
                </li>
            )
        }
    }

    if (!text || !url) return null

    return (
        <li className="article-block__pill">
            <a className="body-3-medium" href={url}>
                {text}
            </a>
        </li>
    )
}

export function PillRow(props: EnrichedBlockPillRow & { className?: string }) {
    return (
        <div className={props.className}>
            <div className="article-block__pill-row-interior span-cols-12 col-start-2">
                <p className="h5-black-caps">{props.title}</p>
                <ul>
                    {props.pills.map((pill, i) => (
                        <Pill key={i} {...pill} />
                    ))}
                </ul>
            </div>
        </div>
    )
}
