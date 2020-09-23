#! /usr/bin/env yarn jest

import { TimeBoundValue } from "grapher/utils/TimeBounds"
import { range } from "grapher/utils/Util"
import { TimelineController, TimeViz } from "./TimelineController"

describe(TimelineController, () => {
    it("can play a timeline", async () => {
        const subject: TimeViz = {
            times: range(2000, 2010),
            startTime: 2000,
            endTime: 2005,
            isPlaying: false,
        }

        let wasPlayed = false
        const controller = new TimelineController(subject, {
            onPlay: () => (wasPlayed = true),
        })
        expect(subject.isPlaying).toEqual(false)
        expect(subject.endTime).toEqual(2005)
        expect(wasPlayed).toEqual(false)
        expect(controller.startTimeProgress).toEqual(0)
        expect(controller.endTimeProgress).toBeLessThan(1)

        const ticks = await controller.play()
        expect(subject.isPlaying).toEqual(false)
        expect(subject.endTime).toEqual(2009)
        expect(wasPlayed).toEqual(true)
        expect(ticks).toEqual(4)

        expect(controller.getNextTime(2008)).toEqual(2009)
        expect(controller.getNextTime(2009)).toEqual(2009)

        expect(controller.startTimeProgress).toEqual(0)
        expect(controller.endTimeProgress).toEqual(1)

        // Can hit play, even if the end is here, and will replay from the beginning
        const ticks2 = await controller.play()
        expect(ticks2).toEqual(9)

        // Can play single year mode
        controller.toggleRangeMode()
        await controller.play(2)
        expect(subject.startTime).toEqual(2002)
    })

    it("can handle when an end handle is dragged past a start handle", () => {
        const subject: TimeViz = {
            times: range(1900, 2010),
            startTime: 2000,
            endTime: 2005,
            isPlaying: false,
        }

        const controller = new TimelineController(subject)
        controller.dragHandleToTime("end", 1950)
        expect(subject.startTime).toEqual(1950)
        expect(subject.endTime).toEqual(2000)
    })

    it("pins time to unboundedLeft or unboundedRight when marker is dragged beyond end of timeline", () => {
        const subject: TimeViz = {
            times: range(1900, 2010),
            startTime: 2000,
            endTime: 2005,
            isPlaying: false,
        }

        const controller = new TimelineController(subject)

        expect(controller.getTimeFromDrag(2009)).toBe(2009)
        expect(controller.getTimeFromDrag(2009.1)).toBe(
            TimeBoundValue.unboundedRight
        )

        expect(controller.getTimeFromDrag(1900)).toBe(1900)
        expect(controller.getTimeFromDrag(1899.9)).toBe(
            TimeBoundValue.unboundedLeft
        )
    })
})
