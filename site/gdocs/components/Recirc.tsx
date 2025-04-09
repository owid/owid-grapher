import { EnrichedBlockRecirc, formatAuthors } from "@ourworldindata/utils"
import { useLinkedDocument } from "../utils.js"
import SpanElement from "./SpanElement.js"

function RecircItem({ url }: { url: string }) {
    const { linkedDocument } = useLinkedDocument(url)
    if (!linkedDocument) return null

    return (
        <aside className="recirc-article-container">
            <h3 className="h3-bold">
                <a href={linkedDocument.url}>{linkedDocument.title}</a>
            </h3>
            {linkedDocument.authors ? (
                <div className="body-3-medium-italic">
                    {formatAuthors(linkedDocument.authors)}
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
                    <SpanElement span={d.title} />
                </span>
                {d.links.map(({ url }) => {
                    return <RecircItem url={url} key={url} />
                })}
            </div>
        </div>
    )
}
