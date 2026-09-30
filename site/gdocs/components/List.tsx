import { EnrichedBlockList, EnrichedBlockText } from "@ourworldindata/utils"
import SpanElements from "./SpanElements.js"

export default function List({
    d,
    className = "",
    shouldRenderLinks = true,
}: {
    d: EnrichedBlockList
    className?: string
    shouldRenderLinks?: boolean
}) {
    return (
        <ul className={className}>
            {d.items.map((_d: EnrichedBlockText, i: number) => {
                return (
                    <li key={i}>
                        <SpanElements
                            spans={_d.value}
                            shouldRenderLinks={shouldRenderLinks}
                        />
                    </li>
                )
            })}
        </ul>
    )
}
