/**
 * DEBUG ONLY, NOT FOR SHIPPING. Delete this file and its single call site in
 * `loadVariable.ts` before opening a pull request.
 *
 * Several of the categorical series worth testing the Swimlane against are
 * published as numeric codes, which `SwimlaneChartState.errorInfo` refuses.
 * This rewrites those indicators into ordinal string columns as they are
 * fetched, using the labels their published charts already put on the map
 * legend, so they can be rendered locally without touching the ETL.
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

export function applyDebugCategoricalOverride(
    variable: OwidVariableDataMetadataDimensions
): OwidVariableDataMetadataDimensions {
    const fake = FAKE_CATEGORIES_BY_VARIABLE_ID[variable.metadata.id]
    if (!fake) return variable

    const nameForCode = (code: unknown): string | unknown =>
        typeof code === "number"
            ? (fake.names[code - fake.firstCode] ?? code)
            : code

    const values: OwidVariableDimensionValuePartial[] = fake.names.map(
        (name, index) => ({ id: index + fake.firstCode, name })
    )

    return {
        data: {
            ...variable.data,
            values: variable.data.values?.map(nameForCode) as any,
        },
        metadata: {
            ...variable.metadata,
            type: "ordinal",
            dimensions: { ...variable.metadata.dimensions, values: { values } },
        },
    }
}
