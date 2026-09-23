import type { IconDefinition } from "@fortawesome/fontawesome-svg-core"
import {
    faAppleWhole,
    faBottleDroplet,
    faBowlRice,
    faCarrot,
    faCow,
    faLeaf,
    faMugHot,
    faShirt,
    faWheatAwn,
} from "@fortawesome/free-solid-svg-icons"
import { OwidDistinctColors } from "@ourworldindata/grapher"

/**
 * The nine commodity groups the source data ships, keyed by the group name as
 * it appears in `deforestation-trade.metadata.json`. The source names are the
 * FAO ones and several are unreadable in a chart label, so every group carries
 * a short label alongside its colour and icon.
 *
 * Colours are `OwidDistinctColors` picked to be semantic (pasture is the
 * deep red of beef, oilseeds the rust of palm oil) while staying far enough
 * apart to read as nine distinct series.
 */
export const COMMODITY_GROUPS: Record<
    string,
    { shortLabel: string; color: string; icon: IconDefinition }
> = {
    Cereals: {
        shortLabel: "Cereals",
        color: OwidDistinctColors.Camel,
        icon: faWheatAwn,
    },
    "Edible roots and tubers with high starch or inulin content": {
        shortLabel: "Roots & tubers",
        color: OwidDistinctColors.Copper,
        icon: faLeaf,
    },
    "Fibre crops": {
        shortLabel: "Fibre crops",
        color: OwidDistinctColors.Teal,
        icon: faShirt,
    },
    "Fruit and nuts": {
        shortLabel: "Fruit & nuts",
        color: OwidDistinctColors.OliveGreen,
        icon: faAppleWhole,
    },
    "Oilseeds and oleaginous fruits": {
        shortLabel: "Oilseeds (soy, palm)",
        color: OwidDistinctColors.RustyOrange,
        icon: faBottleDroplet,
    },
    Pasture: {
        shortLabel: "Beef (pasture)",
        color: OwidDistinctColors.Maroon,
        icon: faCow,
    },
    "Pulses (dried leguminous vegetables)": {
        shortLabel: "Pulses",
        color: OwidDistinctColors.DarkOliveGreen,
        icon: faBowlRice,
    },
    "Stimulant, spice and aromatic crops": {
        shortLabel: "Stimulants (cocoa, coffee)",
        color: OwidDistinctColors.Purple,
        icon: faMugHot,
    },
    Vegetables: {
        shortLabel: "Vegetables",
        color: OwidDistinctColors.Lime,
        icon: faCarrot,
    },
}

/** Colour for a group the metadata lists but this file doesn't know about. */
const FALLBACK_COLOR: string = OwidDistinctColors.Denim
const FALLBACK_ICON = faLeaf

/** The short, chart-ready label; an unknown group falls back to its own name. */
export function getGroupLabel(name: string): string {
    return COMMODITY_GROUPS[name]?.shortLabel ?? name
}

export function getGroupColor(name: string): string {
    return COMMODITY_GROUPS[name]?.color ?? FALLBACK_COLOR
}

export function getGroupIcon(name: string): IconDefinition {
    return COMMODITY_GROUPS[name]?.icon ?? FALLBACK_ICON
}

/** The side of the box `renderGroupIcon` draws into. */
export const GROUP_ICON_SIZE = 16

/** The glyph itself is drawn smaller than its box and centred in it, so it
 *  sits comfortably inside the disc the Sankey draws behind it */
const GROUP_GLYPH_SIZE = 11

/**
 * A group's FontAwesome glyph as a bare `<path>`, scaled uniformly from the
 * icon's own viewBox into a `0 0 16 16` box and centred in it. Returning a
 * path rather than `<FontAwesomeIcon>` lets the caller place it anywhere in an
 * SVG it is already drawing, such as a Sankey node.
 */
export function renderGroupIcon(name: string, fill: string): React.ReactNode {
    const icon = getGroupIcon(name)
    const [width, height, , , pathData] = icon.icon
    const d = Array.isArray(pathData) ? pathData.join(" ") : pathData

    const scale = GROUP_GLYPH_SIZE / Math.max(width, height)
    const x = (GROUP_ICON_SIZE - width * scale) / 2
    const y = (GROUP_ICON_SIZE - height * scale) / 2

    return (
        <path
            d={d}
            fill={fill}
            transform={`translate(${x} ${y}) scale(${scale})`}
        />
    )
}

/**
 * A group's icon as a standalone inline SVG, for HTML contexts such as
 * tooltips. In the chart itself the icon is drawn by `renderGroupIcon` inside
 * the Sankey's own SVG.
 */
export function GroupIcon({
    group,
    size = GROUP_ICON_SIZE,
    className,
}: {
    group: string
    size?: number
    className?: string
}): React.ReactElement {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox={`0 0 ${GROUP_ICON_SIZE} ${GROUP_ICON_SIZE}`}
            aria-hidden
        >
            {renderGroupIcon(group, getGroupColor(group))}
        </svg>
    )
}
