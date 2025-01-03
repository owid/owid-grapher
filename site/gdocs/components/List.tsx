import { EnrichedBlockList, EnrichedBlockText } from "@ourworldindata/utils"
import SpanElements from "./SpanElements.js"

export default function List({
    d,
    className = "",
}: {
    d: EnrichedBlockList
    className?: string
}) {
    return (
        <ul className={className}>
            {d.items.map((_d: EnrichedBlockText, i: number) => {
                return (
                    <li key={i}>
                        <SpanElements spans={_d.value} />
                    </li>
                )
            })}
        </ul>
    )
}
