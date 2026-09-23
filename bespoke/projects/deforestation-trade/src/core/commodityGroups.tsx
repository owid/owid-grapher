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
    {
        shortLabel: string
        /** What the group covers, with its biggest drivers of deforestation
         *  first (worldwide, 2023); shown in the group's tooltip */
        description: string
        /** Ends "…of forest was cleared, most of it for ___" */
        clearedFor: string
        color: string
        icon: IconDefinition
    }
> = {
    Cereals: {
        shortLabel: "Cereals",
        clearedFor: "cereals",
        description:
            "Forest cleared to grow grain crops, mainly rice and maize, but also barley, wheat, sorghum and millet.",
        color: OwidDistinctColors.Camel,
        icon: faWheatAwn,
    },
    "Edible roots and tubers with high starch or inulin content": {
        shortLabel: "Roots & tubers",
        clearedFor: "roots and tubers",
        description:
            "Forest cleared to grow starchy root crops, mostly cassava, but also yams, potatoes, sweet potatoes and taro.",
        color: OwidDistinctColors.Copper,
        icon: faLeaf,
    },
    "Fibre crops": {
        shortLabel: "Fibre crops",
        clearedFor: "fibre crops like rubber and cotton",
        description:
            "Forest cleared to grow crops used as materials rather than food, mostly rubber trees and cotton, but also tobacco, sisal and jute.",
        color: OwidDistinctColors.Teal,
        icon: faShirt,
    },
    "Fruit and nuts": {
        shortLabel: "Fruit & nuts",
        clearedFor: "fruit and nuts",
        description:
            "Forest cleared to grow fruit and nut trees, such as plantains, cashews and bananas, but also guavas, mangoes and avocados.",
        color: OwidDistinctColors.OliveGreen,
        icon: faAppleWhole,
    },
    "Oilseeds and oleaginous fruits": {
        shortLabel: "Oilseeds (soy, palm)",
        clearedFor: "oilseeds like soy and palm oil",
        description:
            "Forest cleared to grow crops for vegetable oil and animal feed, mainly soybeans and oil palms, but also sunflowers, groundnuts, rapeseed and coconuts.",
        color: OwidDistinctColors.RustyOrange,
        icon: faBottleDroplet,
    },
    Pasture: {
        shortLabel: "Beef (pasture)",
        clearedFor: "beef herding",
        description:
            "Forest cleared to create pasture for grazing cattle, raised for beef.",
        color: OwidDistinctColors.Maroon,
        icon: faCow,
    },
    "Pulses (dried leguminous vegetables)": {
        shortLabel: "Pulses",
        clearedFor: "pulses",
        description:
            "Forest cleared to grow beans and other legumes that are sold dried, mainly common beans and cowpeas, but also chickpeas, pigeon peas and lentils.",
        color: OwidDistinctColors.DarkOliveGreen,
        icon: faBowlRice,
    },
    "Stimulant, spice and aromatic crops": {
        shortLabel: "Stimulants (cocoa, coffee)",
        clearedFor: "cocoa, coffee and other stimulant crops",
        description:
            "Forest cleared to grow cocoa and coffee, but also tea, maté, and spices such as nutmeg, cardamom and cinnamon.",
        color: OwidDistinctColors.Purple,
        icon: faMugHot,
    },
    Vegetables: {
        shortLabel: "Vegetables",
        clearedFor: "vegetables",
        description:
            "Forest cleared to grow vegetables, such as okra, onions and tomatoes, but also peppers, green maize and pumpkins.",
        color: OwidDistinctColors.Lime,
        icon: faCarrot,
    },
}

/** Colour for a group the metadata lists but this file doesn't know about. */
const FALLBACK_COLOR: string = OwidDistinctColors.Denim
const FALLBACK_ICON = faLeaf

/** The short, chart-ready label; an unknown group falls back to its own name. */
export function getGroupClearedFor(name: string): string {
    return COMMODITY_GROUPS[name]?.clearedFor ?? name.toLowerCase()
}

export function getGroupDescription(name: string): string | undefined {
    return COMMODITY_GROUPS[name]?.description
}

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
