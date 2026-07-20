import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCaretDown } from "@fortawesome/free-solid-svg-icons"
import { DataPageDataV2 } from "@ourworldindata/types"

// Feature flag for which indicator-switcher UI to render on multi-indicator
// data pages. Override per-request via the URL query string,
// e.g. `?switcher=h-tabs` or `?switcher=v-tabs`.
export type SwitcherVariant = "dropdown" | "h-tabs" | "v-tabs" | "h-pills"
export const DEFAULT_SWITCHER_VARIANT: SwitcherVariant = "h-pills"
const ALL_SWITCHER_VARIANTS: readonly SwitcherVariant[] = [
    "dropdown",
    "h-tabs",
    "v-tabs",
    "h-pills",
]

export const useSwitcherVariant = (): SwitcherVariant => {
    const [variant, setVariant] = useState<SwitcherVariant>(
        DEFAULT_SWITCHER_VARIANT
    )
    useEffect(() => {
        if (typeof window === "undefined") return
        const sp = new URLSearchParams(window.location.search)
        const v = sp.get("switcher")
        if (v && ALL_SWITCHER_VARIANTS.includes(v as SwitcherVariant)) {
            setVariant(v as SwitcherVariant)
        }
    }, [])
    return variant
}

type IndicatorEntry = { datapageData: DataPageDataV2 }

export const labelForIndicator = (datapageData: DataPageDataV2): string => {
    const title = datapageData.title.title
    const variant = datapageData.titleVariant
    return variant && !title.includes(variant) ? `${title} – ${variant}` : title
}

// Label that sits next to (or above) the indicator switcher. Renders as
// "ABOUT THIS DATA (3 indicators)". Shared by all switcher variants so the
// wording + counting logic live in one place.
export const IndicatorAboutLabel = ({
    indicatorCount,
    className,
}: {
    indicatorCount: number
    className?: string
}) => (
    <span className={cx("indicator-switcher__label-group", className)}>
        <span className="indicator-switcher__label">About this data</span>
        {indicatorCount > 1 && (
            <span className="indicator-switcher__count">
                ({indicatorCount} indicators)
            </span>
        )}
    </span>
)

// Cap on how many tab buttons render before the rest collapse into a
// "More ▾" overflow dropdown. With many-indicator charts (e.g.
// annual-number-of-deaths-by-cause has ~30) an uncapped tab row gets
// unwieldy in both horizontal and vertical layouts. Mobile h-tabs use a
// lower cap because the row wraps too aggressively otherwise.
const MAX_VISIBLE_TABS_DESKTOP = 5
const MAX_VISIBLE_TABS_MOBILE = 3

// Matches the SCSS `@media (max-width: 767px)` breakpoint used for the
// v-tabs responsive stack in IndicatorSwitcher.scss.
const MOBILE_MEDIA_QUERY = "(max-width: 767px)"

const useIsMobile = (): boolean => {
    const [isMobile, setIsMobile] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return
        const mq = window.matchMedia(MOBILE_MEDIA_QUERY)
        const update = () => setIsMobile(mq.matches)
        update()
        mq.addEventListener("change", update)
        return () => mq.removeEventListener("change", update)
    }, [])
    return isMobile
}

const splitForOverflow = (
    indicators: IndicatorEntry[],
    max: number
): {
    visible: IndicatorEntry[]
    overflow: IndicatorEntry[]
    overflowStartIndex: number
} => {
    if (indicators.length <= max) {
        return {
            visible: indicators,
            overflow: [],
            overflowStartIndex: indicators.length,
        }
    }
    const visibleCount = max - 1
    return {
        visible: indicators.slice(0, visibleCount),
        overflow: indicators.slice(visibleCount),
        overflowStartIndex: visibleCount,
    }
}

// Position a fixed popover anchored to a trigger button, with outside-click
// + Esc dismissal and reflow on scroll/resize. Shared by the dropdown
// variant and the tabs' overflow "More" menu.
const usePopoverAnchor = (
    triggerRef: React.RefObject<HTMLElement | null>,
    popoverRef: React.RefObject<HTMLElement | null>,
    open: boolean,
    setOpen: (o: boolean) => void,
    { matchTriggerWidth = false }: { matchTriggerWidth?: boolean } = {}
): React.CSSProperties => {
    const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})
    useEffect(() => {
        if (!open) return
        const updatePos = () => {
            if (!triggerRef.current) return
            const r = triggerRef.current.getBoundingClientRect()
            setPopoverStyle({
                position: "fixed",
                top: r.bottom + 4,
                left: r.left,
                ...(matchTriggerWidth ? { minWidth: r.width } : {}),
            })
        }
        updatePos()
        const onDocMouseDown = (e: MouseEvent) => {
            const target = e.target as Node
            if (
                popoverRef.current?.contains(target) ||
                triggerRef.current?.contains(target)
            )
                return
            setOpen(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false)
        }
        document.addEventListener("mousedown", onDocMouseDown)
        document.addEventListener("keydown", onKey)
        window.addEventListener("scroll", updatePos, true)
        window.addEventListener("resize", updatePos)
        return () => {
            document.removeEventListener("mousedown", onDocMouseDown)
            document.removeEventListener("keydown", onKey)
            window.removeEventListener("scroll", updatePos, true)
            window.removeEventListener("resize", updatePos)
        }
    }, [open, triggerRef, popoverRef, setOpen, matchTriggerWidth])
    return popoverStyle
}

const IndicatorOptionsPopover = ({
    popoverRef,
    popoverStyle,
    indicators,
    startIndex,
    activeIndex,
    onSelect,
}: {
    popoverRef: React.RefObject<HTMLDivElement | null>
    popoverStyle: React.CSSProperties
    indicators: IndicatorEntry[]
    startIndex: number
    activeIndex: number
    onSelect: (i: number) => void
}) => {
    if (typeof document === "undefined") return null
    return createPortal(
        <div
            ref={popoverRef}
            className="indicator-switcher__popover"
            style={popoverStyle}
            role="listbox"
        >
            {indicators.map((ind, i) => {
                const idx = startIndex + i
                return (
                    <button
                        type="button"
                        key={idx}
                        role="option"
                        aria-selected={idx === activeIndex}
                        className={cx("indicator-switcher__option", {
                            "indicator-switcher__option--active":
                                idx === activeIndex,
                        })}
                        onClick={() => onSelect(idx)}
                    >
                        {labelForIndicator(ind.datapageData)}
                    </button>
                )
            })}
        </div>,
        document.body
    )
}

// Dropdown variant: the indicator title renders as an MDIM-style pill
// button (mirrors .md-settings__dropdown-toggle) that opens a listbox of
// all the chart's indicators.
export const IndicatorDropdown = ({
    activeDatapageData,
    indicators,
    activeIndex,
    onIndicatorChange,
}: {
    activeDatapageData: DataPageDataV2
    indicators: IndicatorEntry[]
    activeIndex: number
    onIndicatorChange: (i: number) => void
}) => {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)
    const popoverStyle = usePopoverAnchor(
        triggerRef,
        popoverRef,
        open,
        setOpen,
        { matchTriggerWidth: true }
    )

    const indicatorTitle = activeDatapageData.title.title
    if (!indicatorTitle) return null
    const titleVariant = activeDatapageData.titleVariant?.trim()

    return (
        <>
            <IndicatorAboutLabel indicatorCount={indicators.length} />
            <button
                type="button"
                ref={triggerRef}
                className="indicator-switcher__dropdown-trigger"
                aria-expanded={open}
                aria-haspopup="listbox"
                data-track-note="metadata_box_indicator_switch"
                onClick={() => setOpen((o) => !o)}
            >
                <span className="indicator-switcher__dropdown-title">
                    {indicatorTitle}
                </span>
                <FontAwesomeIcon
                    icon={faCaretDown}
                    className="indicator-switcher__caret"
                />
            </button>
            {titleVariant && (
                <span className="indicator-switcher__title-variant">
                    {titleVariant}
                </span>
            )}
            {open && (
                <IndicatorOptionsPopover
                    popoverRef={popoverRef}
                    popoverStyle={popoverStyle}
                    indicators={indicators}
                    startIndex={0}
                    activeIndex={activeIndex}
                    onSelect={(i) => {
                        onIndicatorChange(i)
                        setOpen(false)
                    }}
                />
            )}
        </>
    )
}

// Renders the overflow "More ▾" trigger + its popover. The trigger reads
// as a normal tab button (so it sits inline with the rest of the tab row)
// and inherits its baseClassName + activeClassName from the parent variant.
const IndicatorMoreDropdown = ({
    overflow,
    overflowStartIndex,
    activeIndex,
    onIndicatorChange,
    baseClassName,
    activeClassName,
}: {
    overflow: IndicatorEntry[]
    overflowStartIndex: number
    activeIndex: number
    onIndicatorChange: (i: number) => void
    baseClassName: string
    activeClassName: string
}) => {
    const [open, setOpen] = useState(false)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const popoverRef = useRef<HTMLDivElement>(null)
    const popoverStyle = usePopoverAnchor(triggerRef, popoverRef, open, setOpen)
    const isActiveInOverflow = activeIndex >= overflowStartIndex
    const label = isActiveInOverflow
        ? labelForIndicator(
              overflow[activeIndex - overflowStartIndex].datapageData
          )
        : "More"
    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                aria-expanded={open}
                aria-haspopup="listbox"
                className={cx(baseClassName, `${baseClassName}--more`, {
                    [activeClassName]: isActiveInOverflow,
                })}
                onClick={() => setOpen((o) => !o)}
                data-track-note="metadata_box_indicator_switch"
            >
                {label}
                <FontAwesomeIcon
                    icon={faCaretDown}
                    className="indicator-switcher__caret"
                />
            </button>
            {open && (
                <IndicatorOptionsPopover
                    popoverRef={popoverRef}
                    popoverStyle={popoverStyle}
                    indicators={overflow}
                    startIndex={overflowStartIndex}
                    activeIndex={activeIndex}
                    onSelect={(i) => {
                        onIndicatorChange(i)
                        setOpen(false)
                    }}
                />
            )}
        </>
    )
}

// Horizontal tab strip. "tabs" = underline-tab strip attached to the box
// (h-tabs variant); "pills" = rounded pill buttons (h-pills variant). Both
// use the same logic and overflow handling; only the class names differ so
// the SCSS can style them independently.
export const IndicatorTabsHorizontal = ({
    indicators,
    activeIndex,
    onIndicatorChange,
    variant = "tabs",
}: {
    indicators: IndicatorEntry[]
    activeIndex: number
    onIndicatorChange: (i: number) => void
    variant?: "tabs" | "pills"
}) => {
    const isMobile = useIsMobile()
    const { visible, overflow, overflowStartIndex } = splitForOverflow(
        indicators,
        isMobile ? MAX_VISIBLE_TABS_MOBILE : MAX_VISIBLE_TABS_DESKTOP
    )
    const containerClass =
        variant === "pills"
            ? "indicator-switcher__h-pills"
            : "indicator-switcher__h-tabs"
    const itemClass =
        variant === "pills"
            ? "indicator-switcher__h-pill"
            : "indicator-switcher__h-tab"
    const itemActiveClass =
        variant === "pills"
            ? "indicator-switcher__h-pill--active"
            : "indicator-switcher__h-tab--active"
    return (
        <div
            className={containerClass}
            role="tablist"
            aria-label="About this data"
        >
            {visible.map((ind, i) => (
                <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === activeIndex}
                    className={cx(itemClass, {
                        [itemActiveClass]: i === activeIndex,
                    })}
                    onClick={() => onIndicatorChange(i)}
                    data-track-note="metadata_box_indicator_switch"
                >
                    {labelForIndicator(ind.datapageData)}
                </button>
            ))}
            {overflow.length > 0 && (
                <IndicatorMoreDropdown
                    overflow={overflow}
                    overflowStartIndex={overflowStartIndex}
                    activeIndex={activeIndex}
                    onIndicatorChange={onIndicatorChange}
                    baseClassName={itemClass}
                    activeClassName={itemActiveClass}
                />
            )}
        </div>
    )
}

// Vertical tab list, rendered as an aside beside the metadata box.
export const IndicatorTabsVertical = ({
    indicators,
    activeIndex,
    onIndicatorChange,
}: {
    indicators: IndicatorEntry[]
    activeIndex: number
    onIndicatorChange: (i: number) => void
}) => {
    const { visible, overflow, overflowStartIndex } = splitForOverflow(
        indicators,
        MAX_VISIBLE_TABS_DESKTOP
    )
    return (
        <aside
            className="indicator-switcher__v-tabs"
            role="tablist"
            aria-orientation="vertical"
            aria-label="Indicator"
        >
            <IndicatorAboutLabel
                indicatorCount={indicators.length}
                className="indicator-switcher__v-tabs-label"
            />
            {visible.map((ind, i) => (
                <button
                    key={i}
                    type="button"
                    role="tab"
                    aria-selected={i === activeIndex}
                    className={cx("indicator-switcher__v-tab", {
                        "indicator-switcher__v-tab--active": i === activeIndex,
                    })}
                    onClick={() => onIndicatorChange(i)}
                    data-track-note="metadata_box_indicator_switch"
                >
                    {labelForIndicator(ind.datapageData)}
                </button>
            ))}
            {overflow.length > 0 && (
                <IndicatorMoreDropdown
                    overflow={overflow}
                    overflowStartIndex={overflowStartIndex}
                    activeIndex={activeIndex}
                    onIndicatorChange={onIndicatorChange}
                    baseClassName="indicator-switcher__v-tab"
                    activeClassName="indicator-switcher__v-tab--active"
                />
            )}
        </aside>
    )
}
