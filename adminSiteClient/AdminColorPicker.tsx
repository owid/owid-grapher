import { type ReactElement, useEffect, useMemo, useState } from "react"
import cx from "classnames"
import {
    type Color,
    type Key,
    parseColor,
    ColorArea,
    ColorThumb,
    ColorSlider,
    SliderTrack,
    ColorField,
    Input,
    Tabs,
    TabList,
    Tab,
    TabPanel,
    SearchField,
    Button,
    TooltipTrigger,
    Tooltip,
    OverlayArrow,
} from "react-aria-components"
import { ColorSchemeName, lastOfNonEmptyArray } from "@ourworldindata/utils"
import {
    ColorSchemes,
    ContinentColors,
    EnergyColors,
    OwidDistinctColors,
    OwidDistinctLinesColors,
    OwidMapColors,
} from "@ourworldindata/grapher"
import "./AdminColorPicker.scss"

interface AdminColorPickerProps {
    color?: string
    showLineChartColors: boolean
    baseColorScheme?: ColorSchemeName
    onColor: (color: string | undefined) => void
    /** Called when the picker's intrinsic size changes (e.g. on details toggle). */
    onResize?: () => void
}

type TabKey = "all" | "regions" | "energy" | "hue"

interface ColorMeta {
    hex: string
    name?: string
    regions: string[]
    energy?: string
}

const DEFAULT_COLOR = "#000000"

// Shared, page-load-scoped UI state remembered across popover opens. Each
// picker reads these on mount; since Tippy `lazy` remounts the content on
// every show, sibling pickers can't drift out of sync.
let lastSelectedTab: TabKey = "all"
let isCustomSectionOpen = false

/** Turn camelCase identifiers ("SubSaharanAfrica") into readable labels. */
function humanizeName(name: string): string {
    if (name.includes(" ")) return name
    return name.replace(/([a-z])([A-Z])/g, "$1 $2")
}

/** Build a case-insensitive hex → name lookup (last match wins, like remeda's invert). */
function invertColorMap(map: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {}
    for (const [name, hex] of Object.entries(map))
        result[hex.toUpperCase()] = name
    return result
}

/** Build a case-insensitive hex → all (deduped, humanized) names mapping. */
function groupNamesByHex(
    map: Record<string, string>
): Record<string, string[]> {
    const result: Record<string, string[]> = {}
    for (const [name, hex] of Object.entries(map)) {
        const key = hex.toUpperCase()
        const label = humanizeName(name)
        const list = (result[key] ??= [])
        if (!list.includes(label)) list.push(label)
    }
    return result
}

/** Parse a hex string into an HSB color so the area/slider channels line up. */
function toHsbColor(hex: string): Color {
    try {
        return parseColor(hex).toFormat("hsb")
    } catch {
        return parseColor(DEFAULT_COLOR).toFormat("hsb")
    }
}

function hueOf(hex: string): number {
    try {
        return parseColor(hex).toFormat("hsl").getChannelValue("hue")
    } catch {
        return 0
    }
}

/**
 * The context-aware OWID Distinct palette, mirroring the previous react-color
 * picker: special map colors for the categorical map scheme, otherwise the
 * distinct (or distinct-lines) palette.
 */
function getGridColors(
    showLineChartColors: boolean,
    baseColorScheme?: ColorSchemeName
): string[] {
    if (baseColorScheme === ColorSchemeName.OwidCategoricalMap)
        return Object.values(OwidMapColors)

    const scheme = showLineChartColors
        ? ColorSchemes.get(ColorSchemeName.OwidDistinctLines)
        : ColorSchemes.get(ColorSchemeName["owid-distinct"])
    return lastOfNonEmptyArray(scheme.colorSets)
}

export function AdminColorPicker({
    color,
    showLineChartColors,
    baseColorScheme,
    onColor,
    onResize,
}: AdminColorPickerProps): ReactElement {
    // The picker remounts on every popover open (Tippy `lazy`), so these
    // initializers always pick up the latest shared UI state.
    const [tab, setTab] = useState<TabKey>(lastSelectedTab)
    const selectTab = (key: TabKey): void => {
        lastSelectedTab = key
        setTab(key)
    }
    const [customOpen, setCustomOpen] = useState(isCustomSectionOpen)
    const handleCustomToggle = (
        e: React.SyntheticEvent<HTMLDetailsElement>
    ): void => {
        const open = e.currentTarget.open
        isCustomSectionOpen = open
        setCustomOpen(open)
        onResize?.()
    }
    const [query, setQuery] = useState("")
    const [pickerColor, setPickerColor] = useState<Color>(() =>
        toHsbColor(color ?? DEFAULT_COLOR)
    )

    // Resync the inline picker when the color is changed externally (e.g. by
    // picking a swatch or resetting), without fighting our own onChange.
    useEffect(() => {
        if (!color) return
        setPickerColor((prev) =>
            prev.toString("hex").toLowerCase() === color.toLowerCase()
                ? prev
                : toHsbColor(color)
        )
    }, [color])

    const nameByHex = useMemo(
        () =>
            invertColorMap({
                ...OwidDistinctColors,
                ...OwidDistinctLinesColors,
                ...OwidMapColors,
            }),
        []
    )
    const regionsByHex = useMemo(() => groupNamesByHex(ContinentColors), [])
    const energyByHex = useMemo(() => invertColorMap(EnergyColors), [])

    // The line-chart palette swaps in darker variants (PeachDarker, etc.) that
    // aren't keys in ContinentColors/EnergyColors. Map each darker hex back to
    // its base hex so region/energy metadata still resolves.
    const baseHexByDarkerHex = useMemo(() => {
        const result: Record<string, string> = {}
        const distinct = OwidDistinctColors as Record<string, string>
        for (const [name, hex] of Object.entries(OwidDistinctLinesColors)) {
            if (!name.endsWith("Darker")) continue
            const baseHex = distinct[name.replace(/Darker$/, "")]
            if (baseHex) result[hex.toUpperCase()] = baseHex.toUpperCase()
        }
        return result
    }, [])

    const metaFor = (hex: string): ColorMeta => {
        const key = hex.toUpperCase()
        const baseKey = baseHexByDarkerHex[key] ?? key
        return {
            hex,
            name: nameByHex[key] ? humanizeName(nameByHex[key]) : undefined,
            regions: regionsByHex[baseKey] ?? [],
            energy: energyByHex[baseKey]
                ? humanizeName(energyByHex[baseKey])
                : undefined,
        }
    }

    const gridColors = useMemo(
        () => getGridColors(showLineChartColors, baseColorScheme),
        [showLineChartColors, baseColorScheme]
    )
    const hueSortedColors = useMemo(
        () => [...gridColors].sort((a, b) => hueOf(a) - hueOf(b)),
        [gridColors]
    )
    const queryTokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const matches = (...texts: (string | undefined)[]): boolean => {
        if (queryTokens.length === 0) return true
        const haystack = texts
            .filter((t): t is string => !!t)
            .join(" ")
            .toLowerCase()
        return queryTokens.every((token) => haystack.includes(token))
    }

    const handleColorChange = (newColor: Color): void => {
        setPickerColor(newColor)
        onColor(newColor.toString("hex"))
    }
    const handleFieldChange = (newColor: Color | null): void => {
        if (newColor) handleColorChange(newColor.toFormat("hsb"))
    }

    const renderTooltip = (meta: ColorMeta): ReactElement => (
        <Tooltip
            className="AdminColorPicker__tooltip"
            placement="bottom"
            offset={8}
        >
            <OverlayArrow className="AdminColorPicker__tooltip-arrow">
                <svg width={8} height={8} viewBox="0 0 8 8">
                    <path d="M0 0 L4 4 L8 0" />
                </svg>
            </OverlayArrow>
            {meta.name && (
                <div className="AdminColorPicker__tooltip-row AdminColorPicker__tooltip-row--name">
                    {meta.name}
                </div>
            )}
            {meta.regions.map((region) => (
                <div key={region} className="AdminColorPicker__tooltip-row">
                    🌍 {region}
                </div>
            ))}
            {meta.energy && (
                <div className="AdminColorPicker__tooltip-row">
                    ⚡ {meta.energy}
                </div>
            )}
            <div className="AdminColorPicker__tooltip-row AdminColorPicker__tooltip-row--hex">
                {meta.hex.toUpperCase()}
            </div>
        </Tooltip>
    )

    const isSelected = (hex: string): boolean =>
        color?.toLowerCase() === hex.toLowerCase()

    const renderTile = (meta: ColorMeta, key: string): ReactElement => {
        const { hex } = meta
        return (
            <TooltipTrigger key={key} delay={0} closeDelay={0}>
                <Button
                    className={cx("AdminColorPicker__tile", {
                        "AdminColorPicker__tile--selected": isSelected(hex),
                    })}
                    style={{ backgroundColor: hex }}
                    aria-label={`${meta.name ?? hex} (${hex})`}
                    onPress={() => onColor(hex)}
                />
                {renderTooltip(meta)}
            </TooltipTrigger>
        )
    }

    const renderCard = (
        displayName: string,
        hex: string,
        key: string
    ): ReactElement => {
        const meta = metaFor(hex)
        return (
            <TooltipTrigger key={key} delay={0} closeDelay={0}>
                <Button
                    className={cx("AdminColorPicker__card", {
                        "AdminColorPicker__card--selected": isSelected(hex),
                    })}
                    aria-label={`${displayName} (${hex})`}
                    onPress={() => onColor(hex)}
                >
                    <span
                        className="AdminColorPicker__card-swatch"
                        style={{ backgroundColor: hex }}
                    />
                    <span className="AdminColorPicker__card-label">
                        {displayName}
                    </span>
                </Button>
                {renderTooltip(meta)}
            </TooltipTrigger>
        )
    }

    const renderGrid = (colors: string[]): ReactElement => {
        const visible = colors
            .map(metaFor)
            .filter((meta) =>
                matches(meta.name, ...meta.regions, meta.energy, meta.hex)
            )
        if (visible.length === 0)
            return (
                <div className="AdminColorPicker__empty">No colors found</div>
            )
        return (
            <div className="AdminColorPicker__grid">
                {visible.map((meta, i) => renderTile(meta, `${meta.hex}-${i}`))}
            </div>
        )
    }

    const renderCards = (entries: [string, string][]): ReactElement => {
        // Deduplicate by displayed region name (e.g. "NorthAmerica" and
        // "North America" collapse to a single card).
        const seenNames = new Set<string>()
        const deduped = entries.filter(([name]) => {
            const label = humanizeName(name)
            if (seenNames.has(label)) return false
            seenNames.add(label)
            return true
        })
        const visible = deduped.filter(([name, hex]) =>
            matches(humanizeName(name), name, hex)
        )
        if (visible.length === 0)
            return (
                <div className="AdminColorPicker__empty">No colors found</div>
            )
        return (
            <div className="AdminColorPicker__cards">
                {visible.map(([name, hex]) =>
                    renderCard(humanizeName(name), hex, name)
                )}
            </div>
        )
    }

    return (
        <div className="AdminColorPicker">
            <SearchField
                className="AdminColorPicker__search"
                aria-label="Search colors"
                value={query}
                onChange={setQuery}
            >
                <Input
                    className="AdminColorPicker__search-input"
                    placeholder="Search colors, regions, or energy types…"
                />
            </SearchField>

            <Tabs
                className="AdminColorPicker__tabs"
                selectedKey={tab}
                onSelectionChange={(key: Key) => selectTab(key as TabKey)}
            >
                <TabList
                    className="AdminColorPicker__chips"
                    aria-label="Color groups"
                >
                    <Tab id="all" className="AdminColorPicker__chip">
                        All
                    </Tab>
                    <Tab id="regions" className="AdminColorPicker__chip">
                        🌍 Regions
                    </Tab>
                    <Tab id="energy" className="AdminColorPicker__chip">
                        ⚡ Energy
                    </Tab>
                    <Tab id="hue" className="AdminColorPicker__chip">
                        🎨 By hue
                    </Tab>
                </TabList>

                <TabPanel id="all" className="AdminColorPicker__panel">
                    {renderGrid(gridColors)}
                </TabPanel>
                <TabPanel id="regions" className="AdminColorPicker__panel">
                    {renderCards(Object.entries(ContinentColors))}
                </TabPanel>
                <TabPanel id="energy" className="AdminColorPicker__panel">
                    {renderCards(Object.entries(EnergyColors))}
                </TabPanel>
                <TabPanel id="hue" className="AdminColorPicker__panel">
                    {renderGrid(hueSortedColors)}
                </TabPanel>
            </Tabs>

            <details
                className="AdminColorPicker__custom"
                open={customOpen}
                onToggle={handleCustomToggle}
            >
                <summary className="AdminColorPicker__custom-title">
                    Custom color
                </summary>
                <ColorArea
                    className="AdminColorPicker__area"
                    value={pickerColor}
                    onChange={handleColorChange}
                    xChannel="saturation"
                    yChannel="brightness"
                    aria-label="Saturation and brightness"
                >
                    <ColorThumb className="AdminColorPicker__area-thumb" />
                </ColorArea>
                <ColorSlider
                    className="AdminColorPicker__slider"
                    value={pickerColor}
                    onChange={handleColorChange}
                    channel="hue"
                    aria-label="Hue"
                >
                    <SliderTrack className="AdminColorPicker__slider-track">
                        <ColorThumb className="AdminColorPicker__slider-thumb" />
                    </SliderTrack>
                </ColorSlider>
                <ColorField
                    className="AdminColorPicker__field"
                    value={pickerColor}
                    onChange={handleFieldChange}
                    aria-label="Hex color"
                >
                    <Input className="AdminColorPicker__field-input" />
                </ColorField>
            </details>
        </div>
    )
}
