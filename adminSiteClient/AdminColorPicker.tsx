import { type ReactElement, useEffect, useMemo, useState } from "react"
import cx from "clsx"
import { useDebounceCallback } from "usehooks-ts"
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
import {
    getAdminColorPalette,
    type ColorPaletteKey,
    type PaletteGroup,
} from "./colorPalettes.js"
import "./AdminColorPicker.scss"

interface AdminColorPickerProps {
    color?: string
    palette: ColorPaletteKey
    onColor: (color: string | undefined) => void
    /** Called when the picker's intrinsic size changes (e.g. on details toggle). */
    onResize?: () => void
}

type TabKey = "all" | "regions" | "energy" | "hue"

interface SwatchInfo {
    hex: string
    name?: string
    regions: string[]
    energy: string[]
}

const DEFAULT_COLOR = "#000000"

// Shared, page-load-scoped UI state remembered across popover opens. Each
// picker reads these on mount; since Tippy `lazy` remounts the content on
// every show, sibling pickers can't drift out of sync.
let lastSelectedTab: TabKey = "all"
let isCustomSectionOpen = false

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

export function AdminColorPicker({
    color,
    palette: paletteKey,
    onColor,
    onResize,
}: AdminColorPickerProps): ReactElement {
    const palette = getAdminColorPalette(paletteKey)

    // The picker remounts on every popover open (Tippy `lazy`), so these
    // initializers always pick up the latest shared UI state.
    const hasEnergyTab = palette.energy.entries.length > 0
    const [tab, setTab] = useState<TabKey>(lastSelectedTab)
    const effectiveTab = tab === "energy" && !hasEnergyTab ? "all" : tab
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

    const infoFor = (hex: string): SwatchInfo => {
        const key = hex.toUpperCase()
        return {
            hex,
            name: palette.nameByHex[key],
            regions: palette.regions.labelsByHex[key] ?? [],
            energy: palette.energy.labelsByHex[key] ?? [],
        }
    }

    const hueSortedColors = useMemo(
        () => [...palette.swatches].sort((a, b) => hueOf(a) - hueOf(b)),
        [palette]
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

    const debouncedOnColor = useDebounceCallback(onColor, 200)

    const handleColorChange = (newColor: Color): void => {
        setPickerColor(newColor)
        debouncedOnColor(newColor.toString("hex"))
    }
    const handleFieldChange = (newColor: Color | null): void => {
        if (newColor) handleColorChange(newColor.toFormat("hsb"))
    }

    const tryApplyColor = (
        text: string,
        requireSixDigitHex: boolean = false
    ): boolean => {
        let cleanText = text.trim()
        const regex = requireSixDigitHex
            ? /^#?[0-9A-Fa-f]{6}$/
            : /^#?[0-9A-Fa-f]{3,8}$/

        if (!cleanText.startsWith("#") && regex.test(cleanText)) {
            cleanText = "#" + cleanText
        } else if (!regex.test(cleanText)) return false

        try {
            const parsed = parseColor(cleanText)
            handleFieldChange(parsed)
            return true
        } catch {
            return false
        }
    }

    const renderTooltip = (info: SwatchInfo): ReactElement => (
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
            {info.name && (
                <div className="AdminColorPicker__tooltip-row AdminColorPicker__tooltip-row--name">
                    {info.name}
                </div>
            )}
            {info.regions.map((region) => (
                <div key={region} className="AdminColorPicker__tooltip-row">
                    🌍 {region}
                </div>
            ))}
            {info.energy.map((energy) => (
                <div key={energy} className="AdminColorPicker__tooltip-row">
                    ⚡ {energy}
                </div>
            ))}
            <div className="AdminColorPicker__tooltip-row AdminColorPicker__tooltip-row--hex">
                {info.hex.toUpperCase()}
            </div>
        </Tooltip>
    )

    const isSelected = (hex: string): boolean =>
        color?.toLowerCase() === hex.toLowerCase()

    const renderTile = (info: SwatchInfo, key: string): ReactElement => {
        const { hex } = info
        return (
            <TooltipTrigger key={key} delay={0} closeDelay={0}>
                <Button
                    className={cx("AdminColorPicker__tile", {
                        "AdminColorPicker__tile--selected": isSelected(hex),
                    })}
                    style={{ backgroundColor: hex }}
                    aria-label={`${info.name ?? hex} (${hex})`}
                    onPress={() => onColor(hex)}
                />
                {renderTooltip(info)}
            </TooltipTrigger>
        )
    }

    const renderCard = (
        displayName: string,
        hex: string,
        key: string
    ): ReactElement => {
        const info = infoFor(hex)
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
                {renderTooltip(info)}
            </TooltipTrigger>
        )
    }

    const renderGrid = (colors: string[]): ReactElement => {
        const visible = colors
            .map(infoFor)
            .filter((info) =>
                matches(info.name, ...info.regions, ...info.energy, info.hex)
            )
        if (visible.length === 0)
            return (
                <div className="AdminColorPicker__empty">No colors found</div>
            )
        return (
            <div className="AdminColorPicker__grid">
                {visible.map((info, i) => renderTile(info, `${info.hex}-${i}`))}
            </div>
        )
    }

    const renderCards = (group: PaletteGroup): ReactElement => {
        const visible = group.entries.filter((entry) =>
            matches(entry.label, entry.name, entry.hex)
        )
        if (visible.length === 0)
            return (
                <div className="AdminColorPicker__empty">No colors found</div>
            )
        return (
            <div className="AdminColorPicker__cards">
                {visible.map((entry) =>
                    renderCard(entry.label, entry.hex, entry.name)
                )}
            </div>
        )
    }

    return (
        <div className="AdminColorPicker">
            <div className="AdminColorPicker__banner">
                <span className="AdminColorPicker__banner-label">
                    {palette.label}
                </span>
            </div>

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
                selectedKey={effectiveTab}
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
                    {hasEnergyTab && (
                        <Tab id="energy" className="AdminColorPicker__chip">
                            ⚡ Energy
                        </Tab>
                    )}
                    <Tab id="hue" className="AdminColorPicker__chip">
                        🎨 By hue
                    </Tab>
                </TabList>

                <TabPanel id="all" className="AdminColorPicker__panel">
                    {renderGrid(palette.swatches)}
                </TabPanel>
                <TabPanel id="regions" className="AdminColorPicker__panel">
                    {renderCards(palette.regions)}
                </TabPanel>
                {hasEnergyTab && (
                    <TabPanel id="energy" className="AdminColorPicker__panel">
                        {renderCards(palette.energy)}
                    </TabPanel>
                )}
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
                    <Input
                        className="AdminColorPicker__field-input"
                        onPaste={(
                            e: React.ClipboardEvent<HTMLInputElement>
                        ): void => {
                            // We have an onPaste handler such that you don't necessarily need to clear the field before pasting a new hex code: if the pasted text is a valid hex color, it'll be applied directly without the user needing to manually delete the old value first.
                            const text = e.clipboardData.getData("text")
                            if (tryApplyColor(text)) {
                                e.preventDefault()
                            }
                        }}
                        onChange={(
                            e: React.ChangeEvent<HTMLInputElement>
                        ): void => {
                            tryApplyColor(e.target.value, true)
                        }}
                    />
                </ColorField>
            </details>
        </div>
    )
}
