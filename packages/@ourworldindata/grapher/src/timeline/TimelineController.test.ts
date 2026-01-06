import { describe, expect, it } from "vitest"

import * as _ from "lodash-es"
import { TimeBoundValue } from "@ourworldindata/utils"
import {
    TimelineController,
    TimelineManager,
    TimelineDragTarget,
} from "./TimelineController"

it("can play a timeline", async () => {
    let wasPlayed = false
    const manager: TimelineManager = {
        times: _.range(2000, 2010),
        startHandleTimeBound: 2000,
        endHandleTimeBound: 2005,
        isPlaying: false,
        onPlay: () => (wasPlayed = true),
    }

    const controller = new TimelineController(manager)
    expect(manager.isPlaying).toEqual(false)
    expect(manager.endHandleTimeBound).toEqual(2005)
    expect(wasPlayed).toEqual(false)
    expect(controller.startTimeProgress).toEqual(0)
    expect(controller.endTimeProgress).toBeLessThan(1)

    const ticks = await controller.play()
    expect(manager.isPlaying).toEqual(false)
    expect(manager.endHandleTimeBound).toEqual(2009)
    expect(wasPlayed).toEqual(true)
    expect(ticks).toEqual(4)

    expect(controller.getNextTime(2008)).toEqual(2009)
    expect(controller.getNextTime(2009)).toEqual(2009)

    expect(controller.startTimeProgress).toEqual(0)
    expect(controller.endTimeProgress).toEqual(1)

    // Can hit play, even if the end is here, and will replay from the beginning
    const ticks2 = await controller.play()
    expect(ticks2).toEqual(9)

    // Start handle also resets if replay triggered
    controller.dragHandleToTime(TimelineDragTarget.Start, controller.maxTime)
    controller.dragHandleToTime(TimelineDragTarget.End, controller.maxTime)
    await controller.play()
    expect(controller.startTimeProgress).toEqual(0)

    // Can play single year mode
    controller.toggleRangeMode()
    await controller.play(2)
    expect(manager.startHandleTimeBound).toEqual(2002)
})

it("can handle when an end handle is dragged past a start handle", () => {
    const manager: TimelineManager = {
        times: _.range(1900, 2010),
        startHandleTimeBound: 2000,
        endHandleTimeBound: 2005,
    }

    const controller = new TimelineController(manager)
    controller.dragHandleToTime(TimelineDragTarget.End, 1950)
    expect(manager.startHandleTimeBound).toEqual(1950)
    expect(manager.endHandleTimeBound).toEqual(2000)
})

it("can report correct progress with Infinity values", () => {
    const manager: TimelineManager = {
        times: _.range(1900, 2010),
        startHandleTimeBound: -Infinity,
        endHandleTimeBound: Infinity,
    }

    const controller = new TimelineController(manager)
    expect(controller.startTimeProgress).toEqual(0)
    expect(controller.endTimeProgress).toEqual(1)
})

it("pins time to unboundedLeft or unboundedRight when range is dragged beyond end of timeline", () => {
    const manager: TimelineManager = {
        times: _.range(1900, 2010),
        startHandleTimeBound: 2000,
        endHandleTimeBound: 2005,
    }

    const controller = new TimelineController(manager)

    expect(controller.clampTimeBound(2009)).toBe(2009)
    expect(controller.clampTimeBound(2009.1)).toBe(
        TimeBoundValue.positiveInfinity
    )

    expect(controller.clampTimeBound(1900)).toBe(1900)
    expect(controller.clampTimeBound(1899.9)).toBe(
        TimeBoundValue.negativeInfinity
    )

    controller.setDragOffsets(2000)
    controller["dragRangeToTime"](3000)
    expect(manager.startHandleTimeBound).toEqual(2004)
    expect(manager.endHandleTimeBound).toEqual(TimeBoundValue.positiveInfinity)
})

it("pins time to unboundedLeft or unboundedRight when marker is dragged beyond end of timeline", () => {
    const manager: TimelineManager = {
        times: _.range(1900, 2010),
        startHandleTimeBound: 2005,
        endHandleTimeBound: 2005,
    }
    const controller = new TimelineController(manager)
    controller["dragRangeToTime"](3000)
    expect(manager.startHandleTimeBound).toEqual(
        TimeBoundValue.positiveInfinity
    )
    expect(manager.endHandleTimeBound).toEqual(TimeBoundValue.positiveInfinity)
})

it("prevents handles from being on the same time when onlyTimeRangeSelectionPossible is true", () => {
    const manager: TimelineManager = {
        times: _.range(2000, 2010),
        startHandleTimeBound: 2000,
        endHandleTimeBound: 2005,
        onlyTimeRangeSelectionPossible: true,
    }

    const controller = new TimelineController(manager)

    // Test dragging start handle towards end handle
    controller.dragHandleToTime(TimelineDragTarget.Start, 2005)
    expect(manager.startHandleTimeBound).toEqual(2004)
    expect(manager.endHandleTimeBound).toEqual(2005)

    // Test dragging end handle towards start handle
    controller.dragHandleToTime(TimelineDragTarget.End, 2004)
    expect(manager.startHandleTimeBound).toEqual(2004)
    expect(manager.endHandleTimeBound).toEqual(2005)

    // Handles can still cross each other - when start is dragged past end,
    // it becomes the end handle and the handles swap positions
    controller.dragHandleToTime(TimelineDragTarget.Start, 2006)
    expect(manager.startHandleTimeBound).toEqual(2005)
    expect(manager.endHandleTimeBound).toEqual(2006)
})

it("allows handles on same time when onlyTimeRangeSelectionPossible is false", () => {
    const manager: TimelineManager = {
        times: _.range(2000, 2010),
        startHandleTimeBound: 2000,
        endHandleTimeBound: 2005,
        onlyTimeRangeSelectionPossible: false,
    }

    const controller = new TimelineController(manager)

    // Dragging start handle to same position as end handle should work
    controller.dragHandleToTime(TimelineDragTarget.Start, 2005)
    expect(manager.startHandleTimeBound).toEqual(2005)
    expect(manager.endHandleTimeBound).toEqual(2005)
})

it("prevents keyboard navigation from putting handles on same time when onlyTimeRangeSelectionPossible is true", () => {
    const manager: TimelineManager = {
        times: _.range(2000, 2010),
        startHandleTimeBound: 2003,
        endHandleTimeBound: 2004,
        onlyTimeRangeSelectionPossible: true,
    }

    const controller = new TimelineController(manager)

    // Test increaseStartTime - should not move to end time
    controller.increaseStartTime()
    expect(manager.startHandleTimeBound).toEqual(2003)
    expect(manager.endHandleTimeBound).toEqual(2004)

    // Test decreaseEndTime - should not move to start time
    controller.decreaseEndTime()
    expect(manager.startHandleTimeBound).toEqual(2003)
    expect(manager.endHandleTimeBound).toEqual(2004)

    // Moving away should work
    controller.decreaseStartTime()
    expect(manager.startHandleTimeBound).toEqual(2002)

    controller.increaseEndTime()
    expect(manager.endHandleTimeBound).toEqual(2005)
})

it("prevents large step keyboard navigation from putting handles on same time when onlyTimeRangeSelectionPossible is true", () => {
    const manager: TimelineManager = {
        times: _.range(2000, 2010),
        startHandleTimeBound: 2003,
        endHandleTimeBound: 2004,
        onlyTimeRangeSelectionPossible: true,
    }

    const controller = new TimelineController(manager)

    // Test increaseStartTimeByLargeStep - should fall back to increaseStartTime
    const initialStart = manager.startHandleTimeBound
    controller.increaseStartTimeByLargeStep()
    // Should not move to 2004 or beyond
    expect(manager.startHandleTimeBound).toEqual(initialStart)

    // Test decreaseEndTimeByLargeStep - should fall back to decreaseEndTime
    const initialEnd = manager.endHandleTimeBound
    controller.decreaseEndTimeByLargeStep()
    // Should not move to 2003 or before
    expect(manager.endHandleTimeBound).toEqual(initialEnd)
})

describe("setStartAndEndTimeFromInput", () => {
    it("sets both handles to the same time", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2000,
            endHandleTimeBound: 2005,
        }
        const controller = new TimelineController(manager)

        controller.setStartAndEndTimeFromInput(2003)
        expect(manager.startHandleTimeBound).toEqual(2003)
        expect(manager.endHandleTimeBound).toEqual(2003)
    })

    it("clamps to positive infinity when beyond max time", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2000,
            endHandleTimeBound: 2005,
        }
        const controller = new TimelineController(manager)

        controller.setStartAndEndTimeFromInput(3000)
        expect(manager.startHandleTimeBound).toEqual(
            TimeBoundValue.positiveInfinity
        )
        expect(manager.endHandleTimeBound).toEqual(
            TimeBoundValue.positiveInfinity
        )
    })

    it("clamps to negative infinity when below min time", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2000,
            endHandleTimeBound: 2005,
        }
        const controller = new TimelineController(manager)

        controller.setStartAndEndTimeFromInput(1000)
        expect(manager.startHandleTimeBound).toEqual(
            TimeBoundValue.negativeInfinity
        )
        expect(manager.endHandleTimeBound).toEqual(
            TimeBoundValue.negativeInfinity
        )
    })
})

describe("setStartTimeFromInput", () => {
    it("sets start time to valid value within range", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2000,
            endHandleTimeBound: 2005,
        }
        const controller = new TimelineController(manager)

        controller.setStartTimeFromInput(2003)
        expect(manager.startHandleTimeBound).toEqual(2003)
        expect(manager.endHandleTimeBound).toEqual(2005)
    })

    it("clamps to positive infinity when beyond max time", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2000,
            endHandleTimeBound: 2005,
        }
        const controller = new TimelineController(manager)

        controller.setStartTimeFromInput(3000)
        expect(manager.startHandleTimeBound).toEqual(2005)
        expect(manager.endHandleTimeBound).toEqual(
            TimeBoundValue.positiveInfinity
        )
    })

    it("clamps to negative infinity when below min time", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2003,
            endHandleTimeBound: 2005,
        }
        const controller = new TimelineController(manager)

        controller.setStartTimeFromInput(1000)
        expect(manager.startHandleTimeBound).toEqual(
            TimeBoundValue.negativeInfinity
        )
        expect(manager.endHandleTimeBound).toEqual(2005)
    })

    it("prevents setting start time equal to end time when onlyTimeRangeSelectionPossible is true", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2000,
            endHandleTimeBound: 2005,
            onlyTimeRangeSelectionPossible: true,
        }
        const controller = new TimelineController(manager)

        // Try to set start time to same as end time
        controller.setStartTimeFromInput(2005)
        // Should be set to previous time instead
        expect(manager.startHandleTimeBound).toEqual(2004)
        expect(manager.endHandleTimeBound).toEqual(2005)
    })

    it("allows setting start time equal to end time when onlyTimeRangeSelectionPossible is false", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2000,
            endHandleTimeBound: 2005,
            onlyTimeRangeSelectionPossible: false,
        }
        const controller = new TimelineController(manager)

        controller.setStartTimeFromInput(2005)
        expect(manager.startHandleTimeBound).toEqual(2005)
        expect(manager.endHandleTimeBound).toEqual(2005)
    })

    it("swaps handles when start time is set beyond end time", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2000,
            endHandleTimeBound: 2005,
        }
        const controller = new TimelineController(manager)

        controller.setStartTimeFromInput(2007)
        expect(manager.startHandleTimeBound).toEqual(2005)
        expect(manager.endHandleTimeBound).toEqual(2007)
    })

    it("swaps handles even when onlyTimeRangeSelectionPossible is true", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2000,
            endHandleTimeBound: 2004,
            onlyTimeRangeSelectionPossible: true,
        }
        const controller = new TimelineController(manager)

        // Set start time beyond end time
        controller.setStartTimeFromInput(2006)
        // Handles should swap
        expect(manager.startHandleTimeBound).toEqual(2004)
        expect(manager.endHandleTimeBound).toEqual(2006)
    })
})

describe("setEndTimeFromInput", () => {
    it("sets end time to valid value within range", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2000,
            endHandleTimeBound: 2005,
        }
        const controller = new TimelineController(manager)

        controller.setEndTimeFromInput(2007)
        expect(manager.startHandleTimeBound).toEqual(2000)
        expect(manager.endHandleTimeBound).toEqual(2007)
    })

    it("clamps to positive infinity when beyond max time", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2000,
            endHandleTimeBound: 2005,
        }
        const controller = new TimelineController(manager)

        controller.setEndTimeFromInput(3000)
        expect(manager.startHandleTimeBound).toEqual(2000)
        expect(manager.endHandleTimeBound).toEqual(
            TimeBoundValue.positiveInfinity
        )
    })

    it("clamps to negative infinity when below min time", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2003,
            endHandleTimeBound: 2005,
        }
        const controller = new TimelineController(manager)

        controller.setEndTimeFromInput(1000)
        expect(manager.startHandleTimeBound).toEqual(
            TimeBoundValue.negativeInfinity
        )
        expect(manager.endHandleTimeBound).toEqual(2003)
    })

    it("prevents setting end time equal to start time when onlyTimeRangeSelectionPossible is true", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2005,
            endHandleTimeBound: 2009,
            onlyTimeRangeSelectionPossible: true,
        }
        const controller = new TimelineController(manager)

        // Try to set end time to same as start time
        controller.setEndTimeFromInput(2005)
        // Should be set to next time instead
        expect(manager.startHandleTimeBound).toEqual(2005)
        expect(manager.endHandleTimeBound).toEqual(2006)
    })

    it("allows setting end time equal to start time when onlyTimeRangeSelectionPossible is false", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2005,
            endHandleTimeBound: 2009,
            onlyTimeRangeSelectionPossible: false,
        }
        const controller = new TimelineController(manager)

        controller.setEndTimeFromInput(2005)
        expect(manager.startHandleTimeBound).toEqual(2005)
        expect(manager.endHandleTimeBound).toEqual(2005)
    })

    it("swaps handles when end time is set below start time", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2005,
            endHandleTimeBound: 2009,
        }
        const controller = new TimelineController(manager)

        controller.setEndTimeFromInput(2003)
        expect(manager.startHandleTimeBound).toEqual(2003)
        expect(manager.endHandleTimeBound).toEqual(2005)
    })

    it("swaps handles even when onlyTimeRangeSelectionPossible is true", () => {
        const manager: TimelineManager = {
            times: _.range(2000, 2010),
            startHandleTimeBound: 2006,
            endHandleTimeBound: 2009,
            onlyTimeRangeSelectionPossible: true,
        }
        const controller = new TimelineController(manager)

        // Set end time below start time
        controller.setEndTimeFromInput(2004)
        // Handles should swap
        expect(manager.startHandleTimeBound).toEqual(2004)
        expect(manager.endHandleTimeBound).toEqual(2006)
    })
})
