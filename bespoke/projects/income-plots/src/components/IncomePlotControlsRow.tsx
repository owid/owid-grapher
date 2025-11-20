import { useAtom } from "jotai"
import { atomCurrentYear, atomTimeInterval } from "../store.ts"
import * as R from "remeda"
import { useEffect, useState } from "react"
import { AVAILABLE_YEARS_RANGE } from "../utils/incomePlotConstants.ts"

export const IncomePlotControlsRow = () => {
    const [timeInterval, nextTimeInterval] = useAtom(atomTimeInterval)
    const [currentYear, setCurrentYear] = useAtom(atomCurrentYear)
    const [currentYearLocal, setCurrentYearLocal] = useState(currentYear)

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
        </div>
    )
}
