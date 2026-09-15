/**
 * DEBUG ONLY, NOT FOR SHIPPING. Delete this file and its single call site in
 * `loadVariable.ts` before opening a pull request.
 *
 * Several of the categorical series worth testing the Swimlane against are
 * published as numeric codes, which `SwimlaneChartState.errorInfo` refuses.
 * This rewrites those indicators into ordinal string columns as they are
 * fetched, using the labels their published charts already put on the map
 * legend, so they can be rendered locally without touching the ETL. It also
 * bins a few numeric series into made-up ordinal categories, for time
 * intervals that no real categorical indicator uses.
 */

import {
    OwidVariableDataMetadataDimensions,
    OwidVariableDimensionValuePartial,
} from "@ourworldindata/types"

interface FakeCategories {
    /** Category names in ascending code order, starting at `firstCode` */
    names: string[]
    firstCode: number
}

const FAKE_CATEGORIES_BY_VARIABLE_ID: Record<number, FakeCategories> = {
    // political-regime
    1210053: {
        names: [
            "Closed autocracy",
            "Electoral autocracy",
            "Electoral democracy",
            "Liberal democracy",
        ],
        firstCode: 0,
    },
    // covid-19-testing-policy, on a daily time axis
    961980: {
        names: [
            "No testing policy",
            "Symptoms & key groups",
            "Anyone with symptoms",
            "Open public testing (incl. asymptomatic)",
        ],
        firstCode: 0,
    },
    // states-involved-in-interstate-conflicts
    816193: { names: ["No", "Yes"], firstCode: 0 },
    // legislation-domestic-violence
    1105094: { names: ["No", "Yes"], firstCode: 0 },
    // peak-birth-month, whose codes run 1 to 12
    1118349: {
        names: [
            "Jan",
            "Feb",
            "Mar",
            "Apr",
            "May",
            "Jun",
            "Jul",
            "Aug",
            "Sep",
            "Oct",
            "Nov",
            "Dec",
        ],
        firstCode: 1,
    },
}

interface FakeBins {
    /** Category names, lowest bin first */
    names: string[]
    /** Upper bound of each bin but the last; a value on a bound goes up */
    thresholds: number[]
}

/** Numeric series binned into ordinal categories, one per time interval */
const FAKE_BINS_BY_VARIABLE_ID: Record<number, FakeBins> = {
    // Daily excess deaths per 100,000 people, on a weekly time axis
    734426: {
        names: [
            "Fewer deaths than expected",
            "Up to 0.1 more",
            "0.1 to 0.3 more",
            "0.3 to 1 more",
            "Over 1 more",
        ],
        thresholds: [0, 0.1, 0.3, 1],
    },
    // Oceanic Niño Index, on a monthly time axis
    1306112: {
        names: [
            "Strong La Niña",
            "Moderate La Niña",
            "Weak La Niña",
            "Neutral",
            "Weak El Niño",
            "Moderate El Niño",
            "Strong El Niño",
        ],
        thresholds: [-1.5, -1, -0.5, 0.5, 1, 1.5],
    },
    // US permanent residents by region of origin, on a decadal time axis
    1305917: {
        names: [
            "Under 10,000",
            "10,000 to 100,000",
            "100,000 to 1 million",
            "Over 1 million",
        ],
        thresholds: [10_000, 100_000, 1_000_000],
    },
}

export function applyDebugCategoricalOverride(
    variable: OwidVariableDataMetadataDimensions
): OwidVariableDataMetadataDimensions {
    const fake = FAKE_CATEGORIES_BY_VARIABLE_ID[variable.metadata.id]
    if (fake)
        return toOrdinalVariable(
            variable,
            fake.names,
            fake.firstCode,
            (code) => fake.names[code - fake.firstCode]
        )

    const bins = FAKE_BINS_BY_VARIABLE_ID[variable.metadata.id]
    if (bins)
        return toOrdinalVariable(variable, bins.names, 0, (value) => {
            const index = bins.thresholds.findIndex((bound) => value < bound)
            return bins.names[index === -1 ? bins.names.length - 1 : index]
        })

    return variable
}

function toOrdinalVariable(
    variable: OwidVariableDataMetadataDimensions,
    names: string[],
    firstId: number,
    nameForNumber: (value: number) => string | undefined
): OwidVariableDataMetadataDimensions {
    const toName = (value: unknown): string | unknown =>
        typeof value === "number" ? (nameForNumber(value) ?? value) : value

    const values: OwidVariableDimensionValuePartial[] = names.map(
        (name, index) => ({ id: index + firstId, name })
    )

    return {
        data: {
            ...variable.data,
            values: variable.data.values?.map(toName) as any,
        },
        metadata: {
            ...variable.metadata,
            type: "ordinal",
            dimensions: { ...variable.metadata.dimensions, values: { values } },
        },
    }
}
