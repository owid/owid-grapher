import cx from "clsx"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faCaretDown, faRightLeft } from "@fortawesome/free-solid-svg-icons"
import {
    Select,
    Button,
    Popover,
    ListBox,
    ListBoxItem,
    ListBoxSection,
    Header,
    SelectValue,
} from "react-aria-components"
import { useMediaQuery } from "usehooks-ts"
import { AdditionalIndicator, DataPageDataV2 } from "@ourworldindata/types"
import { SMALL_BREAKPOINT_MEDIA_QUERY } from "./SiteConstants.js"
import { SiteAnalytics } from "./SiteAnalytics.js"
import { appendTitleVariant } from "./datapageUtils.js"

const analytics = new SiteAnalytics()

const baseLabelForIndicator = (datapageData: DataPageDataV2): string => {
    // Prefer the chart author's per-dimension display.name so pill labels
    // match the chart's own series labels; fall back to the pane title.
    return appendTitleVariant(
        datapageData.chartDimensionName ?? datapageData.title.title,
        datapageData.titleVariant
    )
}

// A scatter plot's bubble-size / colour pane says which role it plays,
// after the indicator's name: "Population (size)".
const AUXILIARY_ROLE_LABEL = { size: "size", color: "color" } as const

// Plain-text label: tooltips, aria/typeahead text and analytics.
const labelForIndicator = (datapageData: DataPageDataV2): string => {
    const label = baseLabelForIndicator(datapageData)
    const role = datapageData.auxiliaryRole
    return role ? `${label} (${AUXILIARY_ROLE_LABEL[role]})` : label
}

// Visible label: the indicator's name, then its role in parentheses.
const IndicatorLabel = ({
    datapageData,
    label = baseLabelForIndicator(datapageData),
}: {
    datapageData: DataPageDataV2
    label?: string
}) => {
    const role = datapageData.auxiliaryRole
    if (!role) return <>{label}</>
    return (
        <>
            {label}{" "}
            <span className="indicator-switcher__aux-role">
                ({AUXILIARY_ROLE_LABEL[role]})
            </span>
        </>
    )
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

const splitForOverflow = (
    indicators: AdditionalIndicator[],
    max: number
): {
    visible: AdditionalIndicator[]
    overflow: AdditionalIndicator[]
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

// A react-aria Select over (a subset of) the chart's indicators, shared by
// the dropdown variant and the tabs' overflow "More" menu. Follows the same
// pattern as site/multiDim/DimensionDropdown.tsx — react-aria provides the
// popover anchoring/flipping, dismissal, focus management, and listbox
// keyboard semantics.
const IndicatorSelect = ({
    indicators,
    startIndex,
    activeIndex,
    onIndicatorChange,
    buttonClassName,
    buttonContent,
    matchTriggerWidth,
    announceValue,
}: {
    indicators: AdditionalIndicator[]
    // Index (into the full indicator list) of the first entry in `indicators`.
    startIndex: number
    activeIndex: number
    onIndicatorChange: (i: number) => void
    buttonClassName: string
    buttonContent: React.ReactNode
    matchTriggerWidth?: boolean
    // The trigger shows custom content rather than react-aria's SelectValue,
    // so its accessible name would be just "Indicator". A visually hidden
    // SelectValue puts the current indicator's name back into it.
    announceValue?: boolean
}) => {
    const isActiveInList =
        activeIndex >= startIndex &&
        activeIndex < startIndex + indicators.length
    // A scatter's size and colour indicators get their own group under the
    // axis indicators; other charts list their indicators without groups.
    const entries = indicators.map((ind, i) => ({ ind, index: startIndex + i }))
    const groups = [
        {
            label: "Main indicators",
            items: entries.filter((e) => !e.ind.datapageData.auxiliaryRole),
        },
        {
            label: "Auxiliary indicators",
            items: entries.filter((e) => e.ind.datapageData.auxiliaryRole),
        },
    ].filter((group) => group.items.length > 0)
    const renderOption = ({
        ind,
        index,
    }: {
        ind: AdditionalIndicator
        index: number
    }) => (
        <ListBoxItem
            key={index}
            id={String(index)}
            className="indicator-switcher__option"
            textValue={labelForIndicator(ind.datapageData)}
        >
            <IndicatorLabel datapageData={ind.datapageData} />
        </ListBoxItem>
    )
    return (
        <Select
            className="indicator-switcher__select"
            value={isActiveInList ? String(activeIndex) : null}
            onChange={(key) => {
                if (typeof key === "string") {
                    const i = Number(key)
                    // Log the actual selection here rather than via a
                    // data-track-note on the trigger: the options render in a
                    // portal, so the delegated document-level tracker only
                    // ever saw the trigger click — i.e. menu OPENS, including
                    // abandoned ones, and never which indicator was chosen.
                    analytics.logSiteClick(
                        "metadata_box_indicator_switch",
                        labelForIndicator(
                            indicators[i - startIndex].datapageData
                        )
                    )
                    onIndicatorChange(i)
                }
            }}
            aria-label="Indicator"
        >
            <Button className={buttonClassName}>
                {buttonContent}
                {announceValue && <SelectValue className="sr-only" />}
            </Button>
            <Popover
                className={cx("indicator-switcher__popover", {
                    "indicator-switcher__popover--match-trigger":
                        matchTriggerWidth,
                })}
                maxHeight={360}
                placement="bottom start"
                offset={4}
            >
                <ListBox
                    className={cx("indicator-switcher__menu", {
                        "indicator-switcher__menu--grouped": groups.length > 1,
                    })}
                >
                    {groups.length > 1
                        ? groups.map((group) => (
                              <ListBoxSection
                                  key={group.label}
                                  className="indicator-switcher__menu-group"
                              >
                                  <Header className="indicator-switcher__menu-group-label">
                                      {group.label}
                                  </Header>
                                  {group.items.map(renderOption)}
                              </ListBoxSection>
                          ))
                        : indicators.map((ind, i) =>
                              renderOption({ ind, index: startIndex + i })
                          )}
                </ListBox>
            </Popover>
        </Select>
    )
}

// The dropdown's select control alone (no "About this data" label): an
// MDIM-style pill button (mirrors .md-settings__dropdown-toggle) that opens
// a listbox of all the chart's indicators. Used by the dropdown variant, and
// by the h-pills variant as its mobile control (pills wrap into a ragged
// stack of rows on narrow screens; a select is one row at any indicator
// count).
export const IndicatorDropdownSelect = ({
    indicators,
    activeIndex,
    onIndicatorChange,
}: {
    indicators: AdditionalIndicator[]
    activeIndex: number
    onIndicatorChange: (i: number) => void
}) => {
    const activeDatapageData = indicators[activeIndex].datapageData
    // Same label as the pills (chart dimension name first), minus the
    // variant, which renders separately below the trigger.
    const indicatorTitle =
        activeDatapageData.chartDimensionName ?? activeDatapageData.title.title
    if (!indicatorTitle) return null
    const titleVariant = activeDatapageData.titleVariant?.trim()

    return (
        <>
            <IndicatorSelect
                indicators={indicators}
                startIndex={0}
                activeIndex={activeIndex}
                onIndicatorChange={onIndicatorChange}
                buttonClassName="indicator-switcher__dropdown-trigger"
                matchTriggerWidth
                announceValue
                buttonContent={
                    <>
                        <span className="indicator-switcher__dropdown-title">
                            <IndicatorLabel
                                datapageData={activeDatapageData}
                                label={indicatorTitle}
                            />
                        </span>
                        <FontAwesomeIcon
                            icon={faCaretDown}
                            className="indicator-switcher__caret"
                        />
                    </>
                }
            />
            {titleVariant && (
                <span className="indicator-switcher__title-variant">
                    {titleVariant}
                </span>
            )}
        </>
    )
}

// The "dropdown-inside" variant's control: a "Switch indicator" button that
// sits beside the pane's title inside the box and opens the indicator menu.
export const IndicatorSwitchButton = ({
    indicators,
    activeIndex,
    onIndicatorChange,
}: {
    indicators: AdditionalIndicator[]
    activeIndex: number
    onIndicatorChange: (i: number) => void
}) => (
    <IndicatorSelect
        indicators={indicators}
        startIndex={0}
        activeIndex={activeIndex}
        onIndicatorChange={onIndicatorChange}
        buttonClassName="indicator-switcher__switch-trigger"
        announceValue
        buttonContent={
            <>
                <FontAwesomeIcon
                    icon={faRightLeft}
                    className="indicator-switcher__switch-icon"
                />
                <span>Switch indicator</span>
                <FontAwesomeIcon
                    icon={faCaretDown}
                    className="indicator-switcher__caret"
                />
            </>
        }
    />
)

// Dropdown variant: "About this data (N)" label + the indicator select.
export const IndicatorDropdown = ({
    indicators,
    activeIndex,
    onIndicatorChange,
}: {
    indicators: AdditionalIndicator[]
    activeIndex: number
    onIndicatorChange: (i: number) => void
}) => (
    <>
        <IndicatorAboutLabel indicatorCount={indicators.length} />
        <IndicatorDropdownSelect
            indicators={indicators}
            activeIndex={activeIndex}
            onIndicatorChange={onIndicatorChange}
        />
    </>
)

// The overflow "More ▾" trigger + its menu. The trigger reads as a normal
// tab button (so it sits inline with the rest of the tab row) and inherits
// its baseClassName + activeClassName from the parent variant.
const IndicatorMoreDropdown = ({
    overflow,
    overflowStartIndex,
    activeIndex,
    onIndicatorChange,
    baseClassName,
    activeClassName,
}: {
    overflow: AdditionalIndicator[]
    overflowStartIndex: number
    activeIndex: number
    onIndicatorChange: (i: number) => void
    baseClassName: string
    activeClassName: string
}) => {
    const isActiveInOverflow = activeIndex >= overflowStartIndex
    const label = isActiveInOverflow ? (
        <IndicatorLabel
            datapageData={
                overflow[activeIndex - overflowStartIndex].datapageData
            }
        />
    ) : (
        "More"
    )
    return (
        <IndicatorSelect
            indicators={overflow}
            startIndex={overflowStartIndex}
            activeIndex={activeIndex}
            onIndicatorChange={onIndicatorChange}
            buttonClassName={cx(baseClassName, `${baseClassName}--more`, {
                [activeClassName]: isActiveInOverflow,
            })}
            buttonContent={
                <>
                    <span className="indicator-switcher__item-label">
                        {label}
                    </span>
                    <FontAwesomeIcon
                        icon={faCaretDown}
                        className="indicator-switcher__caret"
                    />
                </>
            }
        />
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
    indicators: AdditionalIndicator[]
    activeIndex: number
    onIndicatorChange: (i: number) => void
    variant?: "tabs" | "pills"
}) => {
    // initializeWithValue: false makes the first client render use the same
    // value the server rendered with (false -> desktop split), so hydration
    // matches the baked HTML; the mobile cap applies in a post-hydration
    // re-render. Without it, usehooks-ts initializes from the live media query
    // and every mobile hydration of a >=4-indicator page is a structural
    // mismatch (React discards and re-renders the whole page tree). On the
    // h-pills variant the pill row is display:none on mobile anyway (the
    // dropdown takes over via CSS), so the cap only shows on h-tabs.
    const isSmallScreen = useMediaQuery(SMALL_BREAKPOINT_MEDIA_QUERY, {
        initializeWithValue: false,
    })
    const { visible, overflow, overflowStartIndex } = splitForOverflow(
        indicators,
        isSmallScreen ? MAX_VISIBLE_TABS_MOBILE : MAX_VISIBLE_TABS_DESKTOP
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
    // Deliberately plain buttons with aria-pressed rather than a
    // role="tablist" — proper tab semantics require arrow-key navigation and
    // aria-controls/tabpanel wiring; without those, announcing tabs would
    // promise interactions that don't exist.
    return (
        <div className={containerClass} role="group" aria-label="Indicator">
            {visible.map((ind, i) => (
                <button
                    key={i}
                    type="button"
                    aria-pressed={i === activeIndex}
                    className={cx(itemClass, {
                        [itemActiveClass]: i === activeIndex,
                    })}
                    onClick={() => onIndicatorChange(i)}
                    data-track-note="metadata_box_indicator_switch"
                    title={labelForIndicator(ind.datapageData)}
                >
                    <span className="indicator-switcher__item-label">
                        <IndicatorLabel datapageData={ind.datapageData} />
                    </span>
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
    indicators: AdditionalIndicator[]
    activeIndex: number
    onIndicatorChange: (i: number) => void
}) => {
    const { visible, overflow, overflowStartIndex } = splitForOverflow(
        indicators,
        MAX_VISIBLE_TABS_DESKTOP
    )
    // Plain buttons with aria-pressed, not role="tablist" — see
    // IndicatorTabsHorizontal.
    return (
        <aside
            className="indicator-switcher__v-tabs"
            role="group"
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
                    aria-pressed={i === activeIndex}
                    className={cx("indicator-switcher__v-tab", {
                        "indicator-switcher__v-tab--active": i === activeIndex,
                    })}
                    onClick={() => onIndicatorChange(i)}
                    data-track-note="metadata_box_indicator_switch"
                >
                    <IndicatorLabel datapageData={ind.datapageData} />
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
