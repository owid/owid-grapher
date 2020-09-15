import xhrMock from "xhr-mock"
import { Indicator } from "explorer/indicatorExplorer/Indicator"

export const mockIndicator = {
    id: 677,
    title: "Child mortality rate",
    subtitle: "The share of newborns who die before reaching the age of five.",
    sourceDesc: "IHME, Global Burden of Disease",
    note:
        "The child mortality rate expresses the probability of a child born in a specific year or period dying before reaching the age of 5 years, if subject to age-specific mortality rates of that period. This is given as the share of live births.",
    dimensions: [
        {
            display: {},
            property: "y",
            variableId: 104402,
        },
    ],
    map: {
        projection: "World",
        targetYear: 2017,
        variableId: 104402,
        equalSizeBins: true,
        timeTolerance: 5,
        baseColorScheme: "YlGnBu",
        isManualBuckets: true,
        colorSchemeLabels: ["", "", "", "", "", "", ""],
        colorSchemeValues: [0.5, 1, 2.5, 5, 10, 15],
        legendDescription: "Child mortality rate (per 1,000 live births)",
        customNumericColors: [],
        customCategoryColors: {},
        customCategoryLabels: {},
        customHiddenCategories: {},
    },
} as Indicator

export const mockIndicators = () => {
    xhrMock.get(/\/explore\/indicators\.json/, {
        body: JSON.stringify({ indicators: [mockIndicator] }),
    })
}

export function initXhrMock() {
    beforeAll(() => xhrMock.setup())
    afterAll(() => xhrMock.teardown())
}
