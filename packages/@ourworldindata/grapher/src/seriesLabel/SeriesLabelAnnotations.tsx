import React from "react"
import { SimpleMarkdownText } from "@ourworldindata/components"
import { SeriesLabelAnnotation } from "./SeriesLabelState.js"

export function SeriesLabelAnnotations({
    annotations,
}: {
    annotations: SeriesLabelAnnotation[]
}): React.ReactElement {
    return (
        <ul
            className="series-label-annotations"
            // Stop mouse events from bubbling through the React portal boundary.
            // Without this, events reach the parent chart's handlers (e.g. LineChart's
            // onMouseMove) because React portals propagate synthetic events through
            // the React component tree, not the DOM tree
            onMouseMove={(e) => e.stopPropagation()}
            onMouseEnter={(e) => e.stopPropagation()}
            onMouseLeave={(e) => e.stopPropagation()}
        >
            {annotations.map((annotation, index) => (
                <li key={index} className="series-label-annotations__entry">
                    <div className="series-label-annotations__heading">
                        {annotation.heading}
                    </div>
                    <SimpleMarkdownText
                        text={annotation.text}
                        openLinksInNewTab
                    />
                </li>
            ))}
        </ul>
    )
}
