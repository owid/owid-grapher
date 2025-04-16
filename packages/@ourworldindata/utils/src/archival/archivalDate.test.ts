import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { formatAsArchivalDate, parseArchivalDate } from "./archivalDate.js"
import dayjs from "../dayjs.js"
import timezoneMock from "timezone-mock"

describe(parseArchivalDate, () => {
    it("parses a date string in the format YYYY-MM-DDTHH:mm:ssZ", () => {
        const dateString = "2020-01-21T12:34:56Z"
        const parsedDate = parseArchivalDate(dateString)
        expect(parsedDate.format()).toBe("2020-01-21T12:34:56Z")
    })

    it("parses a date string in the ARCHIVE_DATE_TIME_FORMAT format", () => {
        const dateString = "20200121-123456"
        const parsedDate = parseArchivalDate(dateString)
        expect(parsedDate.format()).toBe("2020-01-21T12:34:56Z")
    })

    it("handles a Date obj correctly", () => {
        const date = new Date()
        const parsedDate = parseArchivalDate(date)
        expect(parsedDate.toISOString()).toBe(date.toISOString())
    })

    describe("handles timezones", () => {
        beforeEach(() => {
            timezoneMock.register("Brazil/East")
        })
        afterEach(() => {
            timezoneMock.unregister()
        })

        it("parses a date string in the format YYYY-MM-DDTHH:mm:ssZ", () => {
            timezoneMock.register("Europe/London")
            const dateString = "2020-01-21T12:34:56Z"
            const parsedDate = parseArchivalDate(dateString)
            expect(parsedDate.format()).toBe("2020-01-21T12:34:56Z")
        })

        it("parses a date string in the ARCHIVE_DATE_TIME_FORMAT format", () => {
            const dateString = "20200121-123456"
            const parsedDate = parseArchivalDate(dateString)
            expect(parsedDate.format()).toBe("2020-01-21T12:34:56Z")
        })

        it("handles a Date obj correctly", () => {
            const date = new Date()
            const parsedDate = parseArchivalDate(date)
            expect(parsedDate.toISOString()).toBe(date.toISOString())
        })
    })
})

describe(formatAsArchivalDate, () => {
    it("formats a date", () => {
        const date = dayjs("2020-01-21T12:34:56Z")
        const formattedDate = formatAsArchivalDate(date)
        expect(formattedDate).toBe("20200121-123456")
    })
})
