import { expect, it, describe } from "vitest"

import { Time } from "@ourworldindata/types"
import {
    toSwimlaneSegments,
    SwimlaneObservation,
    SwimlaneSegment,
} from "./swimlaneSegments"

interface Case {
    name: string
    observations: SwimlaneObservation[]
    columnTimesAsc: Time[]
    expected: SwimlaneSegment[]
}

const cases: Case[] = [
    {
        name: "a clean run of one category merges into a single segment",
        observations: [
            { time: 2000, category: "A" },
            { time: 2001, category: "A" },
            { time: 2002, category: "A" },
            { time: 2003, category: "A" },
        ],
        columnTimesAsc: [2000, 2001, 2002, 2003],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2000,
                endTime: 2003,
                endTimeExclusive: 2004,
            },
        ],
    },
    {
        name: "two categories abutting produce two segments with no gap between them",
        observations: [
            { time: 2000, category: "A" },
            { time: 2001, category: "A" },
            { time: 2002, category: "B" },
            { time: 2003, category: "B" },
        ],
        columnTimesAsc: [2000, 2001, 2002, 2003],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2000,
                endTime: 2001,
                endTimeExclusive: 2002,
            },
            {
                kind: "category",
                category: "B",
                startTime: 2002,
                endTime: 2003,
                endTimeExclusive: 2004,
            },
        ],
    },
    {
        name: "the same category on either side of a gap stays two category segments separated by a missing segment, not one merged run",
        observations: [
            { time: 2000, category: "A" },
            { time: 2001, category: "A" },
            { time: 2004, category: "A" },
        ],
        columnTimesAsc: [2000, 2001, 2002, 2003, 2004],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2000,
                endTime: 2001,
                endTimeExclusive: 2002,
            },
            {
                kind: "missing",
                startTime: 2002,
                endTime: 2003,
                endTimeExclusive: 2004,
            },
            {
                kind: "category",
                category: "A",
                startTime: 2004,
                endTime: 2004,
                endTimeExclusive: 2005,
            },
        ],
    },
    {
        name: "a leading gap precedes the entity's first observation",
        observations: [
            { time: 2001, category: "A" },
            { time: 2002, category: "A" },
        ],
        columnTimesAsc: [2000, 2001, 2002],
        expected: [
            {
                kind: "missing",
                startTime: 2000,
                endTime: 2000,
                endTimeExclusive: 2001,
            },
            {
                kind: "category",
                category: "A",
                startTime: 2001,
                endTime: 2002,
                endTimeExclusive: 2003,
            },
        ],
    },
    {
        name: "a trailing gap follows the entity's last observation",
        observations: [
            { time: 2000, category: "A" },
            { time: 2001, category: "A" },
        ],
        columnTimesAsc: [2000, 2001, 2002],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2000,
                endTime: 2001,
                endTimeExclusive: 2002,
            },
            {
                kind: "missing",
                startTime: 2002,
                endTime: 2002,
                endTimeExclusive: 2003,
            },
        ],
    },
    {
        name: "a single observation in a multi-time column is surrounded by missing segments",
        observations: [{ time: 2001, category: "A" }],
        columnTimesAsc: [2000, 2001, 2002, 2003],
        expected: [
            {
                kind: "missing",
                startTime: 2000,
                endTime: 2000,
                endTimeExclusive: 2001,
            },
            {
                kind: "category",
                category: "A",
                startTime: 2001,
                endTime: 2001,
                endTimeExclusive: 2002,
            },
            {
                kind: "missing",
                startTime: 2002,
                endTime: 2003,
                endTimeExclusive: 2004,
            },
        ],
    },
    {
        name: "a column with exactly one time falls back to a trailing width of 1",
        observations: [{ time: 2000, category: "A" }],
        columnTimesAsc: [2000],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2000,
                endTime: 2000,
                endTimeExclusive: 2001,
            },
        ],
    },
    {
        name: "decadal spacing with an observation at every decade merges into one segment without inventing a gap",
        observations: [
            { time: 1950, category: "A" },
            { time: 1960, category: "A" },
            { time: 1970, category: "A" },
            { time: 1980, category: "A" },
        ],
        columnTimesAsc: [1950, 1960, 1970, 1980],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 1950,
                endTime: 1980,
                endTimeExclusive: 1990,
            },
        ],
    },
    {
        name: "a gap spanning several consecutive missing times collapses to one missing segment",
        observations: [
            { time: 2000, category: "A" },
            { time: 2001, category: "A" },
            { time: 2005, category: "B" },
            { time: 2006, category: "B" },
        ],
        columnTimesAsc: [2000, 2001, 2002, 2003, 2004, 2005, 2006],
        expected: [
            {
                kind: "category",
                category: "A",
                startTime: 2000,
                endTime: 2001,
                endTimeExclusive: 2002,
            },
            {
                kind: "missing",
                startTime: 2002,
                endTime: 2004,
                endTimeExclusive: 2005,
            },
            {
                kind: "category",
                category: "B",
                startTime: 2005,
                endTime: 2006,
                endTimeExclusive: 2007,
            },
        ],
    },
    {
        name: "no observations at all gives one missing segment covering the whole column",
        observations: [],
        columnTimesAsc: [2000, 2001, 2002],
        expected: [
            {
                kind: "missing",
                startTime: 2000,
                endTime: 2002,
                endTimeExclusive: 2003,
            },
        ],
    },
    {
        name: "an empty columnTimesAsc gives an empty array",
        observations: [],
        columnTimesAsc: [],
        expected: [],
    },
]

describe(toSwimlaneSegments, () => {
    it.each(cases)("$name", ({ observations, columnTimesAsc, expected }) => {
        expect(toSwimlaneSegments({ observations, columnTimesAsc })).toEqual(
            expected
        )
    })
})
