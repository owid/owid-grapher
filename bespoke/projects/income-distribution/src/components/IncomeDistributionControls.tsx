import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faFlag, faGlobe } from "@fortawesome/free-solid-svg-icons"

import {
    Controls,
    ControlsRow,
    LabeledControl,
} from "../../../../components/Controls/Controls.js"
import {
    Switcher,
    SwitcherItem,
} from "../../../../components/Switcher/Switcher.js"

import { Currency, PovertyLineMode, TimeInterval, View } from "../core/types.js"
import { CountryMultiSelect } from "./CountryMultiSelect.js"
import { IncomeUnitPicker } from "./IncomeUnitPicker.js"

export interface IncomeDistributionControlsProps {
    view: View
    setView: (v: View) => void
    selectedCountries: string[]
    setSelectedCountries: (names: string[]) => void
    /** Sorted names from the year's data */
    availableCountries: string[]
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
}

const VIEW_ITEMS: SwitcherItem<View>[] = [
    {
        key: "global",
        element: (
            <>
                <FontAwesomeIcon icon={faGlobe} size="sm" aria-hidden />
                Global
            </>
        ),
    },
    {
        key: "countries",
        element: (
            <>
                <FontAwesomeIcon icon={faFlag} size="sm" aria-hidden />
                Selected countries
            </>
        ),
    },
]

const POVERTY_LINE_ITEMS: SwitcherItem<PovertyLineMode>[] = [
    { key: "off", element: "Off", hint: "Remove poverty line" },
    {
        key: "international",
        element: "International poverty line",
        // Always in international-$ per day, whatever the chart is measured in
        hint: "The extreme poverty line set by the World Bank, of $3 a day",
    },
    { key: "custom", element: "Custom", hint: "Select your own poverty line" },
]

export function IncomeDistributionControls({
    view,
    setView,
    selectedCountries,
    setSelectedCountries,
    availableCountries,
    timeInterval,
    setTimeInterval,
    currency,
    setCurrency,
    currencies,
    suggestedCurrency,
    povertyLineMode,
    setPovertyLineMode,
    isNarrow,
}: IncomeDistributionControlsProps): React.ReactElement {
    return (
        <Controls className="income-distribution-controls">
            <ControlsRow>
                <LabeledControl
                    label="View"
                    className="income-distribution-controls__switcher"
                >
                    <Switcher
                        items={VIEW_ITEMS}
                        selectedKey={view}
                        onChange={setView}
                        ariaLabel="View"
                    />
                </LabeledControl>
                {view === "countries" && (
                    <LabeledControl
                        label="Countries"
                        className="income-distribution-controls__countries"
                    >
                        <CountryMultiSelect
                            availableCountries={availableCountries}
                            selectedCountries={selectedCountries}
                            onChange={setSelectedCountries}
                            isNarrow={isNarrow}
                        />
                    </LabeledControl>
                )}
                <LabeledControl
                    label="Measured in"
                    className="income-distribution-controls__units"
                >
                    <IncomeUnitPicker
                        currency={currency}
                        setCurrency={setCurrency}
                        currencies={currencies}
                        suggestedCurrency={suggestedCurrency}
                        timeInterval={timeInterval}
                        setTimeInterval={setTimeInterval}
                        isNarrow={isNarrow}
                    />
                </LabeledControl>
                <LabeledControl
                    label="Poverty line"
                    className="income-distribution-controls__switcher"
                >
                    <Switcher
                        items={POVERTY_LINE_ITEMS}
                        selectedKey={povertyLineMode}
                        onChange={setPovertyLineMode}
                        ariaLabel="Poverty line"
                    />
                </LabeledControl>
            </ControlsRow>
        </Controls>
    )
}
