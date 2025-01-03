import {
    EnrichedBlockNumberedList,
    EnrichedBlockText,
} from "@ourworldindata/utils"
import SpanElements from "./SpanElements.js"

export default function NumberedList({
    d,
    className = "",
}: {
    d: EnrichedBlockNumberedList
    className?: string
}) {
    return (
        <ol className={className}>
            {d.items.map((_d: EnrichedBlockText, i: number) => {
                return (
                    <li key={i}>
                        <SpanElements spans={_d.value} />
                    </li>
                )
            })}
        </ol>
    )
}
