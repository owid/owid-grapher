import { Tippy } from "@ourworldindata/utils"

import { useTippyContainer } from "../../../../hooks/useTippyContainer.js"
import type { WelfareType } from "../core/types.js"
import { WELFARE_TYPE_BADGES } from "../core/welfareType.js"

/**
 * Diameter of the badge in px, border included, and the gap between it and
 * the name before it. Mirrored by .income-distribution-welfare-badge
 */
export const WELFARE_BADGE_SIZE = 12
export const WELFARE_BADGE_GAP = 4
/** Font size of the badge's letter in px */
// 0.6 of the badge, as the glyph in Grapher's .icon-circled-s
const WELFARE_BADGE_FONT_SIZE = 7.2

/** Shown on hover and focus; like Grapher's details-on-demand tooltips */
const TIPPY_PROPS: Partial<React.ComponentProps<typeof Tippy>> = {
    theme: "light income-distribution-welfare",
    placement: "top",
    interactive: false,
    arrow: false,
    delay: [150, 0],
    maxWidth: 320,
}

function WelfareTooltipContent({
    welfareType,
}: {
    welfareType: WelfareType
}): React.ReactElement {
    const { title, description } = WELFARE_TYPE_BADGES[welfareType]
    return (
        <div className="income-distribution-welfare-tooltip">
            <div className="income-distribution-welfare-tooltip__title">
                {title}
            </div>
            <p className="income-distribution-welfare-tooltip__body">
                {description}
            </p>
        </div>
    )
}

/** The ring and its letter, centred on (`cx`, `cy`) */
function WelfareBadgeGlyph({
    letter,
    cx,
    cy,
    dataKey,
}: {
    letter: string
    cx: number
    cy: number
    dataKey?: string
}): React.ReactElement {
    return (
        <>
            <circle
                className="income-distribution-welfare-badge-svg__circle"
                data-key={dataKey}
                cx={cx}
                cy={cy}
                // The stroke straddles the edge, so the ring stays 12px
                r={(WELFARE_BADGE_SIZE - 1) / 2}
            />
            {/* The baseline sits a bit below the centre so Lato's capitals,
                which have no descender, are centred (measured at 8×) */}
            <text
                className="income-distribution-welfare-badge-svg__letter"
                x={cx}
                y={cy}
                dy="0.375em"
                textAnchor="middle"
                fontSize={WELFARE_BADGE_FONT_SIZE}
                fontWeight={700}
                pointerEvents="none"
            >
                {letter}
            </text>
        </>
    )
}

/**
 * The "I" (income) or "C" (consumption) badge after a country's name in the
 * legend, explained in a tooltip on hover or focus
 */
export function WelfareBadge({
    welfareType,
}: {
    welfareType: WelfareType
}): React.ReactElement {
    const { ref, getTippyContainer } = useTippyContainer<HTMLSpanElement>()
    const { letter, title } = WELFARE_TYPE_BADGES[welfareType]
    return (
        <Tippy
            {...TIPPY_PROPS}
            content={<WelfareTooltipContent welfareType={welfareType} />}
            appendTo={getTippyContainer}
        >
            <span
                ref={ref}
                className="income-distribution-welfare-badge"
                role="img"
                aria-label={title}
                tabIndex={0}
            >
                {/* Drawn as SVG like the badge on the curve labels, so the letter sits in the same spot in both */}
                <svg
                    width={WELFARE_BADGE_SIZE}
                    height={WELFARE_BADGE_SIZE}
                    viewBox={`0 0 ${WELFARE_BADGE_SIZE} ${WELFARE_BADGE_SIZE}`}
                    aria-hidden
                >
                    <WelfareBadgeGlyph
                        letter={letter}
                        cx={WELFARE_BADGE_SIZE / 2}
                        cy={WELFARE_BADGE_SIZE / 2}
                    />
                </svg>
            </span>
        </Tippy>
    )
}

/**
 * The same badge drawn in SVG, for the country labels above the curves:
 * centred on (`cx`, `cy`)
 */
export function SvgWelfareBadge({
    welfareType,
    cx,
    cy,
    dataKey,
    getTippyContainer,
}: {
    welfareType: WelfareType
    cx: number
    cy: number
    /** The series it belongs to, so hovering it highlights that series' curve */
    dataKey: string
    /** Where the tooltip mounts: inside the shadow root (useTippyContainer) */
    getTippyContainer: () => Element
}): React.ReactElement {
    const { letter, title } = WELFARE_TYPE_BADGES[welfareType]
    return (
        <Tippy
            {...TIPPY_PROPS}
            content={<WelfareTooltipContent welfareType={welfareType} />}
            appendTo={getTippyContainer}
        >
            <g
                className="income-distribution-welfare-badge-svg"
                role="img"
                aria-label={title}
                tabIndex={0}
            >
                <WelfareBadgeGlyph
                    letter={letter}
                    cx={cx}
                    cy={cy}
                    dataKey={dataKey}
                />
            </g>
        </Tippy>
    )
}
