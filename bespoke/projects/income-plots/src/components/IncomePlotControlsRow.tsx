import { useAtom, useAtomValue } from "jotai"
import {
    atomCountriesOrRegionsMode,
    atomCurrentCurrency,
    atomCurrentYear,
    atomIsInCountryMode,
    atomIsInSingleCountryMode,
    atomSelectedCountryNames,
    atomTimeInterval,
} from "../store.ts"
import * as R from "remeda"
import { IncomePlotCountrySelector } from "./IncomePlotCountrySelector.tsx"
import { Checkbox, LabeledSwitch } from "@ourworldindata/components"
import cx from "classnames"

export const IncomePlotControlsRowTop = () => {
    const [countriesOrRegionsMode, nextCountriesOrRegionsMode] = useAtom(
        atomCountriesOrRegionsMode
    )
    const isInCountryMode = useAtomValue(atomIsInCountryMode)
    const selectedCountryNames = useAtomValue(atomSelectedCountryNames)
    const [selectedCountriesOnly, setSelectedCountriesOnly] = useAtom(
        atomIsInSingleCountryMode
    )
    return (
        <div className="income-plot-controls-top" style={{ marginBottom: 10 }}>
            <div className="regions-countries-toggle">
                <span
                    className={cx("toggle-label", {
                        active: countriesOrRegionsMode === "regions",
                    })}
                    onClick={() => {
                        if (countriesOrRegionsMode !== "regions")
                            nextCountriesOrRegionsMode()
                    }}
                >
                    Show regions
                </span>
                <LabeledSwitch
                    value={countriesOrRegionsMode === "countries"}
                    onToggle={nextCountriesOrRegionsMode}
                />
                <span
                    className={cx("toggle-label", {
                        active: countriesOrRegionsMode === "countries",
                    })}
                    onClick={() => {
                        if (countriesOrRegionsMode !== "countries")
                            nextCountriesOrRegionsMode()
                    }}
                >
                    Show countries
                </span>
            </div>
            {isInCountryMode && <IncomePlotCountrySelector />}
            {selectedCountryNames.length > 0 && (
                <Checkbox
                    label={`Show selected countries only (${selectedCountryNames.length})`}
                    checked={selectedCountriesOnly}
                    onChange={(e) =>
                        setSelectedCountriesOnly(e.currentTarget.checked)
                    }
                ></Checkbox>
            )}
        </div>
    )
}

export const IncomePlotControlsRowBottom = () => {
    const [timeInterval, nextTimeInterval] = useAtom(atomTimeInterval)
    const [currentYear] = useAtom(atomCurrentYear)
    const [currentCurrency, nextCurrency] = useAtom(atomCurrentCurrency)

    return (
        <div className="income-plot-controls-bottom">
            <button onClick={nextTimeInterval} className="control-pill">
                {R.toTitleCase(timeInterval)}
            </button>
            <span className="control-text">income or consumption in</span>
            <button className="control-pill">{currentYear}</button>
            <span className="control-text">in</span>
            <button onClick={nextCurrency} className="control-pill">
                {currentCurrency === "INTD"
                    ? "international-$"
                    : R.toUpperCase(currentCurrency)}
            </button>
        </div>
    )
}
