import React from "react"
import { createPortal } from "react-dom"
import { observable, runInAction } from "mobx"
import { observer } from "mobx-react"
import { SeriesName, Time } from "@ourworldindata/types"
import { roundForSvg } from "@ourworldindata/utils"
import {
    MarkdownTextWrap,
    MarkdownTextWrapHtml,
} from "@ourworldindata/components"
import { GRAPHER_BACKGROUND } from "../color/ColorConstants"

/**
 * EXPERIMENT: a hard-coded data point annotation for a single chart.
 *
 * Hovering the annotated time replaces the series' dot with an "i" icon,
 * and the series label on the right shows the same "i" icon next to it.
 * A dropdown on the page switches between two variants:
 * - "label": the label carries a dotted underline and opens a
 *   details-on-demand popup on hover; the icon on the line is decorative and
 *   stays visible while the popup is open
 * - "marker": clicking the icon on the line opens the popup; the label has
 *   no underline and no popup
 */
export interface LineChartAnnotation {
    seriesName: SeriesName
    time: Time
    /** Markdown, rendered like a DoD (the first line is the title) */
    text: string
}

const ANNOTATIONS_BY_CHART_SLUG: Record<string, LineChartAnnotation> = {
    "share-elec-by-source": {
        seriesName: "Coal",
        time: 1956,
        text: [
            "Why 1956 matters for coal",
            "In 1956, coal's share of global electricity began a long decline as oil and hydropower expanded rapidly in the post-war boom. This placeholder text explains why the data for this year is interesting and what changed in the energy mix around that time.",
            "🔗 [Read more about coal and electricity](https://ourworldindata.org/energy-mix)",
        ].join("\n\n"),
    },
}

export function getLineChartAnnotation(
    slug: string | undefined
): LineChartAnnotation | undefined {
    return slug ? ANNOTATIONS_BY_CHART_SLUG[slug] : undefined
}

export type AnnotationVariant = "label" | "marker"

const VARIANT_STORAGE_KEY = "owid-line-chart-annotation-variant"

const VARIANT_OPTIONS: { value: AnnotationVariant; label: string }[] = [
    { value: "label", label: "Option 1: DoD on the label" },
    { value: "marker", label: "Option 2: DoD on the chart icon" },
]

function readStoredVariant(): AnnotationVariant {
    try {
        const stored = localStorage.getItem(VARIANT_STORAGE_KEY)
        if (stored === "label" || stored === "marker") return stored
    } catch {
        // localStorage may be unavailable
    }
    return "label"
}

export const annotationVariant = observable.box<AnnotationVariant>(
    typeof window !== "undefined" ? readStoredVariant() : "label"
)

function setAnnotationVariant(variant: AnnotationVariant): void {
    runInAction(() => annotationVariant.set(variant))
    try {
        localStorage.setItem(VARIANT_STORAGE_KEY, variant)
    } catch {
        // localStorage may be unavailable
    }
}

/** Renders a variant dropdown into the page, right above the chart */
@observer
export class AnnotationVariantPicker extends React.Component<
    Record<string, never>,
    { container?: HTMLElement }
> {
    override state: { container?: HTMLElement } = {}

    override componentDidMount(): void {
        const figure = document.querySelector("figure[data-grapher-src]")
        const element = document.createElement("div")
        element.className = "line-chart-annotation-variant-picker"
        // Styled inline since grapher's styles are scoped to the chart
        element.style.cssText =
            "margin: 16px auto 0; padding: 0 16px; text-align: center; font-size: 14px;"
        if (figure?.parentElement) {
            figure.parentElement.insertBefore(element, figure)
        } else {
            element.style.cssText +=
                "position: fixed; top: 16px; left: 16px; z-index: 100; background: #fff;"
            document.body.appendChild(element)
        }
        this.setState({ container: element })
    }

    override componentWillUnmount(): void {
        this.state.container?.remove()
    }

    override render(): React.ReactNode {
        const { container } = this.state
        if (!container) return null

        return createPortal(
            <label>
                Experiment variant{" "}
                <select
                    style={{ marginLeft: 8, padding: "4px 8px", fontSize: 14 }}
                    value={annotationVariant.get()}
                    onChange={(e) =>
                        setAnnotationVariant(
                            e.target.value as AnnotationVariant
                        )
                    }
                >
                    {VARIANT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </label>,
            container
        )
    }
}

export const ANNOTATED_MARKER_RADIUS_FACTOR = 2

/** Size of the icon next to the label */
export function getAnnotationIconRadius(labelFontSize: number): number {
    return labelFontSize * 0.5
}

export function AnnotationDodContent({
    text,
}: {
    text: string
}): React.ReactElement {
    const textWrap = new MarkdownTextWrap({
        text,
        fontSize: 12,
        lineHeight: 1.55,
    })
    return (
        <div className="dod-container">
            <MarkdownTextWrapHtml textWrap={textWrap} />
        </div>
    )
}

/** A filled circle with an "i" in it, centered on (x, y), that pops in */
export function AnnotationInfoIcon({
    x,
    y,
    radius,
    fill,
    opacity = 1,
    clickable = false,
}: {
    x: number
    y: number
    radius: number
    fill: string
    opacity?: number
    clickable?: boolean
}): React.ReactElement {
    return (
        <g transform={`translate(${roundForSvg(x)}, ${roundForSvg(y)})`}>
            <g
                className={
                    clickable
                        ? "line-chart-annotated-marker line-chart-annotated-marker--clickable"
                        : "line-chart-annotated-marker"
                }
            >
                <circle
                    r={roundForSvg(radius)}
                    fill={fill}
                    fillOpacity={opacity}
                    stroke={GRAPHER_BACKGROUND}
                    strokeWidth={1}
                />
                <text
                    className="line-chart-annotated-marker__icon"
                    textAnchor="middle"
                    dy="0.35em"
                    fontSize={roundForSvg(radius * 1.3)}
                    fill={GRAPHER_BACKGROUND}
                >
                    i
                </text>
            </g>
        </g>
    )
}
