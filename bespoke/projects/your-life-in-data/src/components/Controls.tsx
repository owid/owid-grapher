import { useEffect, useState } from "react"
import { useAtom, useAtomValue } from "jotai"

import {
    ENTITY_NAME,
    WORLD_CODE,
    comparisonOptionsFor,
} from "../helpers/catalog.js"
import { birthYearAtom, compareCodeAtom, countryCodeAtom } from "../atoms.js"
import { CountryCombobox } from "./CountryCombobox.js"

const CURRENT_YEAR = new Date().getFullYear()

/** The input row: country combobox, birth year, comparison entity */
export function Controls() {
    const code = useAtomValue(countryCodeAtom)
    const [birthYear, setBirthYear] = useAtom(birthYearAtom)
    const [compareCode, setCompareCode] = useAtom(compareCodeAtom)

    const compareOptions = comparisonOptionsFor(code)

    // reset the comparison entity when it isn't available for the new country
    useEffect(() => {
        if (!compareOptions.includes(compareCode)) setCompareCode(WORLD_CODE)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code])

    // A free-typed draft, separate from the committed atom value: while
    // typing a year, intermediate values (e.g. "1" or "19") fall outside
    // [1900, CURRENT_YEAR], and a controlled input bound directly to the
    // clamped atom would just refuse to display them.
    const [yearDraft, setYearDraft] = useState(String(birthYear))
    useEffect(() => {
        setYearDraft(String(birthYear))
    }, [birthYear])

    return (
        <div className="your-life-in-data__controls">
            <div className="your-life-in-data__control your-life-in-data__control--grow">
                <CountryCombobox />
            </div>
            <div className="your-life-in-data__control your-life-in-data__control--year">
                <label
                    className="your-life-in-data__control-label"
                    htmlFor="your-life-in-data-year"
                >
                    …and when?
                </label>
                <input
                    id="your-life-in-data-year"
                    type="number"
                    min={1900}
                    max={CURRENT_YEAR}
                    value={yearDraft}
                    onChange={(e) => {
                        setYearDraft(e.target.value)
                        const year = parseInt(e.target.value, 10)
                        if (
                            Number.isFinite(year) &&
                            year >= 1900 &&
                            year <= CURRENT_YEAR
                        )
                            setBirthYear(year)
                    }}
                    onBlur={() => setYearDraft(String(birthYear))}
                />
            </div>
            <div className="your-life-in-data__control your-life-in-data__control--grow">
                <label
                    className="your-life-in-data__control-label"
                    htmlFor="your-life-in-data-compare"
                >
                    Compared with
                </label>
                <select
                    id="your-life-in-data-compare"
                    value={
                        compareOptions.includes(compareCode)
                            ? compareCode
                            : WORLD_CODE
                    }
                    onChange={(e) => setCompareCode(e.target.value)}
                >
                    {compareOptions.map((c) => (
                        <option key={c} value={c}>
                            {ENTITY_NAME[c] ?? c}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    )
}
