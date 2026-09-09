import { Time } from "@ourworldindata/types"

export interface SwimlaneObservation {
    time: Time
    category: string
}

export type SwimlaneSegment =
    | {
          kind: "category"
          category: string
          startTime: Time
          endTime: Time
          endTimeExclusive: Time
      }
    | {
          kind: "missing"
          startTime: Time
          endTime: Time
          endTimeExclusive: Time
      }

export function toSwimlaneSegments({
    observations,
    columnTimesAsc,
}: {
    observations: SwimlaneObservation[]
    columnTimesAsc: Time[]
}): SwimlaneSegment[] {
    if (columnTimesAsc.length === 0) return []

    const lastIndex = columnTimesAsc.length - 1
    const categoryByTime = new Map(
        observations.map(({ time, category }) => [time, category])
    )
    const categoryByTimeIndex = columnTimesAsc.map((time) =>
        categoryByTime.get(time)
    )
    const trailingStep =
        lastIndex > 0
            ? columnTimesAsc[lastIndex] - columnTimesAsc[lastIndex - 1]
            : 1

    const segments: SwimlaneSegment[] = []
    let startIndex = 0
    for (let index = 0; index <= lastIndex; index++) {
        const isRunEnd =
            index === lastIndex ||
            categoryByTimeIndex[index + 1] !== categoryByTimeIndex[index]
        if (!isRunEnd) continue

        const range = {
            startTime: columnTimesAsc[startIndex],
            endTime: columnTimesAsc[index],
            endTimeExclusive:
                index < lastIndex
                    ? columnTimesAsc[index + 1]
                    : columnTimesAsc[index] + trailingStep,
        }
        const category = categoryByTimeIndex[index]
        segments.push(
            category === undefined
                ? { kind: "missing", ...range }
                : { kind: "category", category, ...range }
        )
        startIndex = index + 1
    }
    return segments
}
