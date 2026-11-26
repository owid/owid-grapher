import cx from "clsx"
import * as _ from "lodash-es"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import {
    faCaretDown,
    faCheck,
    faRightLeft,
} from "@fortawesome/free-solid-svg-icons"
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
import { useEffect, useRef } from "react"
import { DataPageDataV2, IndicatorPaneData } from "@ourworldindata/types"
import { SiteAnalytics } from "./SiteAnalytics.js"
import { appendTitleVariant } from "./datapageUtils.js"

const analytics = new SiteAnalytics()

interface IndicatorSwitcherProps {
    panes: IndicatorPaneData[]
    activeIndex: number
    onChange: (index: number) => void
}

/**
 * The chart's own name for the indicator where it has one, so that the menu
 * matches the chart's legend, and what a scatter plot uses it for:
 * "Population (size)".
 */
function getIndicatorLabel(datapageData: DataPageDataV2): string {
    const name = appendTitleVariant(
        datapageData.chartDimensionName ?? datapageData.title.title,
        datapageData.titleVariant
    )
    return datapageData.auxiliaryRole
        ? `${name} (${datapageData.auxiliaryRole})`
        : name
}

/**
 * A select over the chart's indicators, with the trigger button as its
 * children. A scatter plot's size and colour indicators get a group of their
 * own in the menu.
 */
function IndicatorSelect({
    panes,
    activeIndex,
    onChange,
    ariaLabel,
    popoverClassName,
    children,
}: IndicatorSwitcherProps & {
    ariaLabel: string
    popoverClassName?: string
    children: React.ReactNode
}): React.ReactElement {
    const options = panes.map(({ datapageData }, index) => ({
        index,
        label: getIndicatorLabel(datapageData),
        isAuxiliary: !!datapageData.auxiliaryRole,
    }))
    const [auxiliaryOptions, mainOptions] = _.partition(
        options,
        (option) => option.isAuxiliary
    )
    const isGrouped = auxiliaryOptions.length > 0 && mainOptions.length > 0

    const renderOption = ({
        index,
        label,
    }: (typeof options)[number]): React.ReactElement => (
        <ListBoxItem
            key={index}
            id={index}
            className="indicator-switcher__option"
            textValue={label}
        >
            {({ isSelected }) => (
                <>
                    {label}
                    {isSelected && (
                        <FontAwesomeIcon
                            className="indicator-switcher__option-check"
                            icon={faCheck}
                        />
                    )}
                </>
            )}
        </ListBoxItem>
    )

    return (
        <Select
            className="indicator-switcher__select"
            aria-label={ariaLabel}
            value={activeIndex}
            onChange={(index) => {
                if (typeof index !== "number" || index === activeIndex) return
                // The menu renders in a portal, where the click tracking on
                // data-track-note doesn't reach
                analytics.logSiteClick(
                    "metadata_box_indicator_switch",
                    options[index].label
                )
                onChange(index)
            }}
        >
            {children}
            <Popover
                className={cx("indicator-switcher__popover", popoverClassName)}
                maxHeight={360}
                placement="bottom start"
                offset={4}
            >
                <ListBox
                    className={cx("indicator-switcher__menu", {
                        "indicator-switcher__menu--grouped": isGrouped,
                    })}
                >
                    {isGrouped ? (
                        <>
                            <ListBoxSection>
                                <Header className="indicator-switcher__menu-group-label">
                                    Main indicators
                                </Header>
                                {mainOptions.map(renderOption)}
                            </ListBoxSection>
                            <ListBoxSection>
                                <Header className="indicator-switcher__menu-group-label">
                                    Auxiliary indicators
                                </Header>
                                {auxiliaryOptions.map(renderOption)}
                            </ListBoxSection>
                        </>
                    ) : (
                        options.map(renderOption)
                    )}
                </ListBox>
            </Popover>
        </Select>
    )
}

/** A "Switch indicator" button for beside a pane's title. */
export function IndicatorSwitchButton({
    focusOnMount = false,
    ...props
}: IndicatorSwitcherProps & {
    /** For the button of the pane that a switch has just shown */
    focusOnMount?: boolean
}): React.ReactElement {
    const buttonRef = useRef<HTMLButtonElement>(null)
    useEffect(() => {
        if (!focusOnMount) return
        // Once the click or key press that chose the indicator is over.
        // Focusing during it would open this button's menu.
        const frame = requestAnimationFrame(() => buttonRef.current?.focus())
        return () => cancelAnimationFrame(frame)
    }, [focusOnMount])

    return (
        // The label repeats the button's visible words, as the button is
        // named by it and not by its content
        <IndicatorSelect {...props} ariaLabel="Switch indicator">
            <Button
                className="indicator-switcher__switch-trigger"
                ref={buttonRef}
            >
                <FontAwesomeIcon
                    icon={faRightLeft}
                    className="indicator-switcher__switch-icon"
                />
                Switch indicator
                {/* Adds the current indicator to the button's name */}
                <SelectValue className="sr-only">
                    {({ selectedText }) => selectedText}
                </SelectValue>
                <FontAwesomeIcon
                    icon={faCaretDown}
                    className="indicator-switcher__caret"
                />
            </Button>
        </IndicatorSelect>
    )
}

/**
 * "About this data (N indicators)" and a dropdown that names the current
 * indicator, for above the metadata box.
 */
export function IndicatorDropdown(
    props: IndicatorSwitcherProps
): React.ReactElement {
    return (
        <>
            <span className="indicator-switcher__label">
                <span className="indicator-switcher__label-title">
                    About this data
                </span>{" "}
                <span className="indicator-switcher__label-count">
                    ({props.panes.length} indicators)
                </span>
            </span>
            <IndicatorSelect
                {...props}
                ariaLabel="Indicator"
                popoverClassName="indicator-switcher__popover--match-trigger"
            >
                <Button className="indicator-switcher__dropdown-trigger">
                    <SelectValue className="indicator-switcher__dropdown-value">
                        {({ selectedText }) => selectedText}
                    </SelectValue>
                    <FontAwesomeIcon
                        icon={faCaretDown}
                        className="indicator-switcher__caret"
                    />
                </Button>
            </IndicatorSelect>
        </>
    )
}
