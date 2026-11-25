import { darkenColorForText } from "@ourworldindata/grapher/src/color/ColorUtils.js"

import { parseRichText } from "../core/richText.js"

/**
 * A walkthrough sentence with its emphasis: bold, italic, and the entities
 * it names in their series colour (when the chart draws them)
 */
export function RichText({
    text,
    entityColors,
}: {
    /** With the markers parseRichText reads */
    text: string
    entityColors?: ReadonlyMap<string, string>
}): React.ReactElement {
    return (
        <>
            {parseRichText(text).map((segment, i) => {
                const color = segment.entity
                    ? entityColors?.get(segment.entity)
                    : undefined
                if (!segment.bold && !segment.italic && !color)
                    return segment.text
                const content = color ? (
                    <span
                        className="income-distribution-tutorial__entity"
                        style={{ color: darkenColorForText(color) }}
                    >
                        {segment.text}
                    </span>
                ) : (
                    segment.text
                )
                const emphasised = segment.italic ? <em>{content}</em> : content
                return segment.bold ? (
                    <strong key={i}>{emphasised}</strong>
                ) : (
                    <span key={i}>{emphasised}</span>
                )
            })}
        </>
    )
}
