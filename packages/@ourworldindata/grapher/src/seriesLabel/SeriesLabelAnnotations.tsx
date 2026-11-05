import React from "react"
import cx from "clsx"
import { SimpleMarkdownText } from "@ourworldindata/components"
import { SeriesLabelAnnotation } from "./SeriesLabelState.js"
import { AnnotationInfoIcon } from "../annotations/AnnotationInfoIcon"
import { RANGE_ANNOTATION_OUTLINE_OPACITY } from "../annotations/AnnotationConstants"

export function SeriesLabelAnnotations({
    annotations,
    title,
    color,
    showGlyphs = false,
}: {
    annotations: SeriesLabelAnnotation[]
    title?: string
    color: string
    showGlyphs?: boolean
}): React.ReactElement {
    return (
        <div
            className="series-label-annotations"
            // Stop mouse events from bubbling through the React portal boundary.
            // Without this, events reach the parent chart's handlers (e.g. LineChart's
            // onMouseMove) because React portals propagate synthetic events through
            // the React component tree, not the DOM tree
            onMouseMove={(e) => e.stopPropagation()}
            onMouseEnter={(e) => e.stopPropagation()}
            onMouseLeave={(e) => e.stopPropagation()}
        >
            {title && (
                <div className="series-label-annotations__title">{title}</div>
            )}
            <ul className="series-label-annotations__list">
                {annotations.map((annotation, index) => (
                    <li
                        key={index}
                        className={cx("series-label-annotations__entry", {
                            "series-label-annotations__entry--with-glyph":
                                showGlyphs,
                        })}
                    >
                        {showGlyphs && (
                            <span className="series-label-annotations__glyph">
                                <AnnotationGlyph
                                    timeScope={annotation.timeScope}
                                    color={color}
                                />
                            </span>
                        )}
                        {annotation.heading && (
                            <div className="series-label-annotations__heading">
                                {annotation.heading}
                            </div>
                        )}
                        <SimpleMarkdownText
                            text={annotation.text}
                            openLinksInNewTab
                        />
                    </li>
                ))}
            </ul>
        </div>
    )
}

const POINT_GLYPH_RADIUS = 6.5
const POINT_GLYPH_SIZE = 2 * (POINT_GLYPH_RADIUS + 1)
const RANGE_GLYPH_WIDTH = 14
const RANGE_GLYPH_HEIGHT = 11

function AnnotationGlyph({
    timeScope,
    color,
}: {
    timeScope: SeriesLabelAnnotation["timeScope"]
    color: string
}): React.ReactElement | null {
    switch (timeScope) {
        case "point":
            return <PointGlyph color={color} />
        case "range":
            return <RangeGlyph color={color} />
        case "all":
            return null
    }
}

function PointGlyph({ color }: { color: string }): React.ReactElement {
    const center = POINT_GLYPH_SIZE / 2
    return (
        <svg
            className="series-label-annotations__glyph-svg series-label-annotations__glyph-svg--point"
            viewBox={`0 0 ${POINT_GLYPH_SIZE} ${POINT_GLYPH_SIZE}`}
        >
            <g transform={`translate(${center}, ${center})`}>
                <AnnotationInfoIcon radius={POINT_GLYPH_RADIUS} color={color} />
            </g>
        </svg>
    )
}

function RangeGlyph({ color }: { color: string }): React.ReactElement {
    const centerY = RANGE_GLYPH_HEIGHT / 2
    return (
        <svg
            className="series-label-annotations__glyph-svg series-label-annotations__glyph-svg--range"
            viewBox={`0 0 ${RANGE_GLYPH_WIDTH} ${RANGE_GLYPH_HEIGHT}`}
        >
            <rect
                width={RANGE_GLYPH_WIDTH}
                height={RANGE_GLYPH_HEIGHT}
                fill={color}
                fillOpacity={RANGE_ANNOTATION_OUTLINE_OPACITY}
            />
            <line
                x1={2}
                x2={RANGE_GLYPH_WIDTH - 2}
                y1={centerY}
                y2={centerY}
                stroke={color}
                strokeWidth={1}
            />
            <circle
                cx={RANGE_GLYPH_WIDTH / 2}
                cy={centerY}
                r={2.5}
                fill={color}
            />
        </svg>
    )
}
