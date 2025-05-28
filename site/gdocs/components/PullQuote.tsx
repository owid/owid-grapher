import { EnrichedBlockPullQuote } from "@ourworldindata/utils"
import Paragraph from "./Paragraph.js"
import { getLayout } from "./layout.js"

export default function PullQuote({
    d,
    className = "",
}: {
    d: EnrichedBlockPullQuote
    className?: string
}) {
    return (
        <div className={className}>
            <blockquote className={d.align}>{d.quote}</blockquote>
            {d.content.map((block, i) => (
                <Paragraph key={i} d={block} className={getLayout("text")} />
            ))}
        </div>
    )
}
