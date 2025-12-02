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
import { useEffect, useState } from "react"
import { AVAILABLE_YEARS_RANGE } from "../utils/incomePlotConstants.ts"
import { IncomePlotCountrySelector } from "./IncomePlotCountrySelector.tsx"
import { Checkbox } from "@ourworldindata/components"

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
        <div style={{ marginBottom: 10 }}>
            <button onClick={nextCountriesOrRegionsMode}>
                {R.toTitleCase(countriesOrRegionsMode)}
            </button>
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
    const [currentYear, setCurrentYear] = useAtom(atomCurrentYear)
    const [currentYearLocal, setCurrentYearLocal] = useState(currentYear)
    const [currentCurrency, nextCurrency] = useAtom(atomCurrentCurrency)

    useEffect(() => {
        if (currentYearLocal !== currentYear) {
            if (
                currentYearLocal >= AVAILABLE_YEARS_RANGE[0] &&
                currentYearLocal <= AVAILABLE_YEARS_RANGE[1]
            ) {
                setCurrentYear(currentYearLocal)
            }
        }
    }, [currentYearLocal, setCurrentYear, currentYear])

    return (
        <div style={{ marginBottom: 10 }}>
            <button onClick={nextTimeInterval}>
                {R.toTitleCase(timeInterval)}
            </button>
            &nbsp;income or consumption in&nbsp;
            <input
                type="number"
                value={currentYearLocal}
                onChange={(e) => setCurrentYearLocal(Number(e.target.value))}
                style={{ width: 50 }}
            />
            &nbsp;in&nbsp;
            <button onClick={nextCurrency}>
                {R.toUpperCase(currentCurrency)}
            </button>
        </div>
    )
}
