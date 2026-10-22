/**
 * DEBUG ONLY, NOT FOR SHIPPING. Delete this file and its call sites in
 * `loadVariable.ts` before opening a pull request.
 *
 * No indicator in the ETL has annotations yet. This merges made-up ones into
 * a few indicators' metadata as they are fetched, so line chart annotations
 * can be checked against real charts locally.
 */

import {
    OwidVariableAnnotation,
    OwidVariableWithSourceAndDimension,
} from "@ourworldindata/types"

const FAKE_ANNOTATIONS_BY_VARIABLE_ID: Record<
    number,
    OwidVariableAnnotation[]
> = {
    // life-expectancy, which selects World and the continents
    1118466: [
        {
            text: "Life expectancy fell sharply during the [Great Chinese Famine](https://en.wikipedia.org/wiki/Great_Chinese_Famine), when tens of millions of people died.",
            entities: ["China"],
            time: 1960,
        },
        {
            text: "Data before 1950 is only available for a handful of years.",
            entities: ["Europe"],
            time: 1950,
        },
        {
            text: "Life expectancy fell in many countries during the **COVID-19 pandemic**.",
            entities: ["Europe"],
            time: 2020,
        },
        {
            // no data point in 1918, the nearest are 1913 and 1950
            text: "The 1918 influenza pandemic killed an estimated 50 million people.",
            entities: ["World"],
            time: 1918,
        },
        {
            text: "The HIV/AIDS epidemic stalled progress across much of the continent.",
            entities: ["Africa"],
            time: 1985,
            timeEnd: 2005,
        },
    ],
    // share-of-children-immunized-dtp3
    1077436: [
        {
            text: "Routine immunization was disrupted during the COVID-19 pandemic.",
            entities: ["Africa (WHO)"],
            time: 2020,
        },
    ],
    // foreign-aid-given-net, where "Non-DAC countries" has a legacy annotation
    1293408: [
        {
            text: "Aid from non-DAC donors rose after the invasion of Ukraine.",
            entities: ["Non-DAC countries"],
            time: 2022,
        },
    ],
    // monthly-temperature-anomalies, on a daily time axis
    1306418: [
        {
            text: "The 2015–16 El Niño was one of the strongest on record.",
            entities: ["World"],
            time: "2016-02-15",
        },
    ],
}

export function applyDebugAnnotationOverride(
    metadata: OwidVariableWithSourceAndDimension
): void {
    const fakeAnnotations = FAKE_ANNOTATIONS_BY_VARIABLE_ID[metadata.id]
    if (!fakeAnnotations) return
    metadata.annotations = [...(metadata.annotations ?? []), ...fakeAnnotations]
}
