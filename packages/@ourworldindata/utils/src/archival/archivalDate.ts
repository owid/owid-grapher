import {
    ARCHIVE_DATE_TIME_FORMAT,
    ArchivalDateString,
} from "@ourworldindata/types"
import dayjs from "../dayjs.js"

export interface ArchivalTimestamp {
    date: Date
    formattedDate: ArchivalDateString
}

export type DateInput = Date | ArchivalDateString | string | dayjs.Dayjs

export const parseArchivalDate = (dateInput: DateInput): dayjs.Dayjs => {
    if (typeof dateInput === "string") {
        if (dateInput.length === ARCHIVE_DATE_TIME_FORMAT.length)
            return dayjs.utc(dateInput, ARCHIVE_DATE_TIME_FORMAT)
        else return dayjs.utc(dateInput)
    }
    return dayjs.utc(dateInput)
}

export const formatAsArchivalDate = (date: dayjs.Dayjs): ArchivalDateString =>
    date.format(ARCHIVE_DATE_TIME_FORMAT) as ArchivalDateString

export const convertToArchivalDateStringIfNecessary = (
    dateInput: DateInput
): ArchivalDateString => {
    if (
        typeof dateInput === "string" &&
        dateInput.length === ARCHIVE_DATE_TIME_FORMAT.length
    )
        return dateInput as ArchivalDateString

    return formatAsArchivalDate(parseArchivalDate(dateInput))
}

export const getDateForArchival = (): ArchivalTimestamp => {
    const date = dayjs
        .utc()
        // it's important here that we explicitly set the milliseconds to 0 -
        // otherwise we run the risk of MySQL rounding up to the next second,
        // which then breaks the archival URL
        .millisecond(0)
    const formattedDate = formatAsArchivalDate(date)

    return { date: date.toDate(), formattedDate }
}
