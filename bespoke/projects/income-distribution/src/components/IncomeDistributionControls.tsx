import { useCallback } from "react"
import cx from "clsx"

import {
    Controls,
    ControlsRow,
    LabeledControl,
} from "../../../../components/Controls/Controls.js"
import {
    Switcher,
    SwitcherItem,
} from "../../../../components/Switcher/Switcher.js"

import {
    DEFAULT_CUSTOM_POVERTY_LINE,
    INT_POVERTY_LINE,
} from "../core/constants.js"
import { Currency, PovertyLineMode, TimeInterval, View } from "../core/types.js"
import type {
    ChartState,
    ChartStateSetters,
} from "../core/useIncomeDistributionState.js"
import { IncomeUnitPicker } from "./IncomeUnitPicker.js"

export interface IncomeDistributionControlsProps {
    view: View
    setView: (v: View) => void
    timeInterval: TimeInterval
    setTimeInterval: (t: TimeInterval) => void
    currency: Currency
    /** Takes a country code (see `currencyKey` in core/currency.ts) or INTERNATIONAL_DOLLAR.code */
    setCurrency: (key: string) => void
    /** Undefined while loading or when the conversions failed to load */
    currencies: Currency[] | undefined
    /** The reader's local currency, if known */
    suggestedCurrency?: Currency
    /** Read off the poverty line, see `povertyLineMode` in core/currency.ts */
    povertyLineMode: PovertyLineMode
    setPovertyLineMode: (mode: PovertyLineMode) => void
    isNarrow: boolean
    /**
     * `card` sits above the chart in a frame of its own; `drawer` stacks the
     * controls full-width, for the narrow chart's bottom sheet
     */
    layout?: "card" | "drawer"
}

/**
 * Two overlapping distributions, one filled and one outlined, sized like the
 * globe next to it and coloured by the switcher through currentColor
 */
/** A mountain of stacked bands, echoing the global view's stacked regions */
function StackedMountainIcon(): React.ReactElement {
    return (
        <svg
            className="income-distribution-controls__view-icon"
            viewBox="0 0 22 14"
            aria-hidden
        >
            <path
                d="M1 13 C5 13 7 1 11 1 S17 13 21 13 Z"
                fill="currentColor"
                opacity={0.35}
            />
            <path
                d="M1 13 C5 13 7 5 11 5 S17 13 21 13 Z"
                fill="currentColor"
                opacity={0.6}
            />
            <path d="M1 13 C5 13 7 9 11 9 S17 13 21 13 Z" fill="currentColor" />
        </svg>
    )
}

function TwoDistributionsIcon(): React.ReactElement {
    return (
        <svg
            className="income-distribution-controls__view-icon"
            viewBox="0 0 22 14"
            aria-hidden
        >
            <path
                d="M1 13 C3.5 13 4.5 2 7.5 2 S11.5 13 14 13 Z"
                fill="currentColor"
                opacity={0.6}
            />
            <path
                d="M7 13 C10 13 11.5 4 14.5 4 S18.5 13 21 13"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.6}
                strokeLinecap="round"
            />
        </svg>
    )
}

const VIEW_ITEMS: SwitcherItem<View>[] = [
    {
        key: "global",
        element: (
            <>
                <StackedMountainIcon />
                Global
            </>
        ),
        hint: "Everyone in the world, stacked by region",
    },
    {
        key: "countries",
        element: (
            <>
                <TwoDistributionsIcon />
                Compare countries
            </>
        ),
        hint: "Selected countries side by side, each scaled to the same area",
    },
]

const POVERTY_LINE_ITEMS: SwitcherItem<PovertyLineMode>[] = [
    { key: "off", element: "Off", hint: "Remove poverty line" },
    {
        key: "international",
        element: "International poverty line",
        // Always in international-$ per day, whatever the chart is measured in
        hint: "The extreme poverty line set by the World\u00a0Bank, of $3 a day",
    },
    { key: "custom", element: "Custom", hint: "Select your own poverty line" },
]

/**
 * The controls' props for the given state. The poverty line control isn't
 * stored: it's read off the line. Only the exact international line, as
 * picked from the control, counts as International; a line dragged or
 * clicked to about $3 stays Custom.
 */
export function useIncomeDistributionControlsProps({
    chartState,
    setters,
    currencies,
    suggestedCurrency,
    isNarrow,
}: {
    chartState: ChartState
    setters: ChartStateSetters
    currencies: Currency[] | undefined
    suggestedCurrency: Currency | undefined
    isNarrow: boolean
}): IncomeDistributionControlsProps {
    const { povertyLine } = chartState
    const { setPovertyLine } = setters
    const povertyLineMode: PovertyLineMode =
        povertyLine === null
            ? "off"
            : povertyLine === INT_POVERTY_LINE
              ? "international"
              : "custom"
    const setPovertyLineMode = useCallback(
        (mode: PovertyLineMode) => {
            if (mode === "off") setPovertyLine(null)
            if (mode === "international") setPovertyLine(INT_POVERTY_LINE)
            // Picking Custom starts the line somewhere other than the
            // international line, ready to be dragged
            if (mode === "custom" && povertyLineMode !== "custom")
                setPovertyLine(DEFAULT_CUSTOM_POVERTY_LINE)
        },
        [povertyLineMode, setPovertyLine]
    )
    return {
        view: chartState.view,
        setView: setters.setView,
        timeInterval: chartState.timeInterval,
        setTimeInterval: setters.setTimeInterval,
        currency: chartState.currency,
        setCurrency: setters.setCurrency,
        currencies,
        suggestedCurrency,
        povertyLineMode,
        setPovertyLineMode,
        isNarrow,
    }
}

export function IncomeDistributionControls({
    view,
    setView,
    timeInterval,
    setTimeInterval,
    currency,
    setCurrency,
    currencies,
    suggestedCurrency,
    povertyLineMode,
    setPovertyLineMode,
    isNarrow,
    layout = "card",
}: IncomeDistributionControlsProps): React.ReactElement {
    const controls = (
        <>
            <ViewControl view={view} setView={setView} />
            <MeasuredInControl
                currency={currency}
                setCurrency={setCurrency}
                currencies={currencies}
                suggestedCurrency={suggestedCurrency}
                timeInterval={timeInterval}
                setTimeInterval={setTimeInterval}
                isNarrow={isNarrow}
            />
            <LabeledControl
                label="Poverty line"
                className={cx(
                    "income-distribution-controls__switcher",
                    "income-distribution-controls__poverty-line"
                )}
            >
                <Switcher
                    items={POVERTY_LINE_ITEMS}
                    selectedKey={povertyLineMode}
                    onChange={setPovertyLineMode}
                    ariaLabel="Poverty line"
                />
            </LabeledControl>
        </>
    )

    if (layout === "drawer")
        return (
            <div className="income-distribution-controls income-distribution-controls--drawer">
                {controls}
            </div>
        )

    return (
        <Controls className="income-distribution-controls">
            <ControlsRow>{controls}</ControlsRow>
        </Controls>
    )
}

/** The View switcher, Global | Compare countries, with its label */
export function ViewControl({
    view,
    setView,
    hideLabel = false,
}: Pick<IncomeDistributionControlsProps, "view" | "setView"> & {
    hideLabel?: boolean
}): React.ReactElement {
    const className = cx(
        "income-distribution-controls__switcher",
        "income-distribution-controls__view"
    )
    const switcher = (
        <Switcher
            items={VIEW_ITEMS}
            selectedKey={view}
            onChange={setView}
            ariaLabel="View"
        />
    )
    if (hideLabel) return <div className={className}>{switcher}</div>
    return (
        <LabeledControl label="View" className={className}>
            {switcher}
        </LabeledControl>
    )
}

/** The currency and time interval picker, with its label */
export function MeasuredInControl({
    currency,
    setCurrency,
    currencies,
    suggestedCurrency,
    timeInterval,
    setTimeInterval,
    isNarrow,
    hideLabel = false,
}: Pick<
    IncomeDistributionControlsProps,
    | "currency"
    | "setCurrency"
    | "currencies"
    | "suggestedCurrency"
    | "timeInterval"
    | "setTimeInterval"
    | "isNarrow"
> & { hideLabel?: boolean }): React.ReactElement {
    const picker = (
        <IncomeUnitPicker
            currency={currency}
            setCurrency={setCurrency}
            currencies={currencies}
            suggestedCurrency={suggestedCurrency}
            timeInterval={timeInterval}
            setTimeInterval={setTimeInterval}
            isNarrow={isNarrow}
        />
    )
    if (hideLabel)
        return (
            <div className="income-distribution-controls__units">{picker}</div>
        )
    return (
        <LabeledControl
            label="Measured in"
            className="income-distribution-controls__units"
        >
            {picker}
        </LabeledControl>
    )
}
