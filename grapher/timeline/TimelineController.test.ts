#! /usr/bin/env yarn jest

import { TimeBoundValue } from "grapher/utils/TimeBounds"
import { range } from "grapher/utils/Util"
import { TimelineController, TimelineManager } from "./TimelineController"

it("can play a timeline", async () => {
    let wasPlayed = false
    const manager: TimelineManager = {
        times: range(2000, 2010),
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
    controller.dragHandleToTime("start", controller.maxTime)
    controller.dragHandleToTime("end", controller.maxTime)
    await controller.play()
    expect(controller.startTimeProgress).toEqual(0)

    // Can play single year mode
    controller.toggleRangeMode()
    await controller.play(2)
    expect(manager.startHandleTimeBound).toEqual(2002)
})

it("can handle when an end handle is dragged past a start handle", () => {
    const manager: TimelineManager = {
        times: range(1900, 2010),
        startHandleTimeBound: 2000,
        endHandleTimeBound: 2005,
    }

    const controller = new TimelineController(manager)
    controller.dragHandleToTime("end", 1950)
    expect(manager.startHandleTimeBound).toEqual(1950)
    expect(manager.endHandleTimeBound).toEqual(2000)
})

it("can report correct progress with Infinity values", () => {
    const manager: TimelineManager = {
        times: range(1900, 2010),
        startHandleTimeBound: -Infinity,
        endHandleTimeBound: Infinity,
    }

    const controller = new TimelineController(manager)
    expect(controller.startTimeProgress).toEqual(0)
    expect(controller.endTimeProgress).toEqual(1)
})

it("pins time to unboundedLeft or unboundedRight when marker is dragged beyond end of timeline", () => {
    const manager: TimelineManager = {
        times: range(1900, 2010),
        startHandleTimeBound: 2000,
        endHandleTimeBound: 2005,
    }

    const controller = new TimelineController(manager)

    expect(controller.getTimeBoundFromDrag(2009)).toBe(2009)
    expect(controller.getTimeBoundFromDrag(2009.1)).toBe(
        TimeBoundValue.positiveInfinity
    )

    expect(controller.getTimeBoundFromDrag(1900)).toBe(1900)
    expect(controller.getTimeBoundFromDrag(1899.9)).toBe(
        TimeBoundValue.negativeInfinity
    )
})
