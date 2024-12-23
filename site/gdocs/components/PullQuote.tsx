import { EnrichedBlockPullQuote } from "@ourworldindata/utils"
export default function PullQuote({
    d,
    className = "",
}: {
    d: EnrichedBlockPullQuote
    className?: string
}) {
    return (
        <blockquote className={className}>
            {d.text.map((d) => d.text).join("\n")}
        </blockquote>
    )
}
