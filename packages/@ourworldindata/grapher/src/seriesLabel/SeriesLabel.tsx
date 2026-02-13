import { match } from "ts-pattern"
import Tippy from "@tippyjs/react"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons"
import {
    GRAPHER_DARK_TEXT,
    GRAPHER_LIGHT_TEXT,
} from "../color/ColorConstants.js"
import {
    SeriesLabelState,
    TextRenderFragment,
    IconRenderFragment,
    TextFragmentRole,
} from "./SeriesLabelState.js"
import { Bounds, isTouchDevice } from "@ourworldindata/utils"
import { AnyRegionDataProvider } from "../core/RegionGroups.js"

const defaultColors: Record<TextFragmentRole, string> = {
    name: GRAPHER_DARK_TEXT,
    value: GRAPHER_DARK_TEXT,
    suffix: GRAPHER_LIGHT_TEXT,
}

export interface SeriesLabelProps {
    state: SeriesLabelState
    x: number
    y: number
    id?: string
    color?: Partial<Record<TextFragmentRole, string>>
    opacity?: number
    onMouseEnter?: React.MouseEventHandler<SVGElement>
    onMouseLeave?: React.MouseEventHandler<SVGElement>
    onInfoTooltipShow?: () => void
}

/**
 * Renders a series label that consists of up to three fragments:
 * - The main label text (e.g. "United States")
 * - An optional suffix that describes the region provider (e.g. "(WHO)")
 * - An optional value label (e.g. "70 years")
 *
 * If the label includes a region provider suffix, an info icon may be
 * rendered next to the suffix, which shows a tooltip with more information
 * about the region provider on hover.
 */
export function SeriesLabel({
    state,
    x,
    y,
    id,
    color,
    opacity,
    onMouseEnter,
    onMouseLeave,
    onInfoTooltipShow,
}: SeriesLabelProps): React.ReactElement {
    // Get the corrected position for SVG text rendering
    const [renderX, renderY] = state.getPositionForSvgRendering(x, y)

    return (
        <g
            id={id}
            opacity={opacity}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            {state.renderFragments.map((fragment) =>
                match(fragment)
                    .with({ type: "text" }, (fragment) => (
                        <TextFragment
                            key={fragment.text}
                            x={renderX}
                            y={renderY}
                            fragment={fragment}
                            color={color}
                            fontSize={state.fontSettings.fontSize}
                        />
                    ))
                    .with({ type: "icon" }, (fragment) => (
                        <IconFragment
                            key={fragment.providerKey}
                            x={renderX}
                            y={renderY}
                            fragment={fragment}
                            color={color}
                            onMouseEnter={onMouseEnter}
                            onMouseLeave={onMouseLeave}
                            onInfoTooltipShow={onInfoTooltipShow}
                        />
                    ))
                    .exhaustive()
            )}
        </g>
    )
}

function TextFragment({
    x,
    y,
    fragment,
    fontSize,
    color,
}: {
    x: number
    y: number
    fragment: TextRenderFragment
    fontSize: number
    color?: Partial<Record<TextFragmentRole, string>>
}): React.ReactElement {
    const fill = color?.[fragment.role] || defaultColors[fragment.role]

    return (
        <text
            x={x + fragment.x}
            y={y + fragment.y}
            fontSize={fontSize.toFixed(2)}
            fontWeight={fragment.fontWeight}
            fill={fill}
        >
            {fragment.text}
        </text>
    )
}

function IconFragment({
    x,
    y,
    fragment,
    color,
    onMouseEnter,
    onMouseLeave,
    onInfoTooltipShow,
}: {
    x: number
    y: number
    fragment: IconRenderFragment
    color?: Partial<Record<TextFragmentRole, string>>
    onMouseEnter?: React.MouseEventHandler<SVGElement>
    onMouseLeave?: React.MouseEventHandler<SVGElement>
    onInfoTooltipShow?: () => void
}): React.ReactElement {
    const iconX = x + fragment.x
    const iconY = y + fragment.y

    const hitAreaSize = isTouchDevice() ? 40 : 20
    const padding = Math.ceil((hitAreaSize - fragment.iconSize) / 2)
    const hitAreaBounds = new Bounds(
        iconX,
        iconY,
        fragment.iconSize,
        fragment.iconSize
    ).expand(padding)

    // The icon has the same color as the suffix text
    const fill = color?.suffix || defaultColors.suffix

    return (
        <g>
            {/* Info icon */}
            <g transform={`translate(${iconX}, ${iconY})`}>
                <FontAwesomeIcon
                    icon={faCircleInfo}
                    width={fragment.iconSize}
                    height={fragment.iconSize}
                    color={fill}
                />
            </g>

            {/* Hit area for tooltip interaction */}
            <Tippy
                theme="grapher-explanation"
                placement="top"
                content={
                    <RegionProviderTooltipContent
                        providerKey={fragment.providerKey}
                    />
                }
                onShow={onInfoTooltipShow}
            >
                <rect
                    {...hitAreaBounds.toProps()}
                    fill="transparent"
                    style={{ pointerEvents: "auto" }}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                />
            </Tippy>
        </g>
    )
}

function RegionProviderTooltipContent({
    providerKey,
}: {
    providerKey: AnyRegionDataProvider
}): React.ReactElement {
    return <div>{providerKey}</div>
}
