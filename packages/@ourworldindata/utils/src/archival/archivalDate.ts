import {
    ARCHIVE_DATE_TIME_FORMAT,
    ArchiveDateString,
} from "@ourworldindata/types"
import dayjs from "../dayjs.js"

export interface ArchivalTimestamp {
    date: Date
    formattedDate: ArchiveDateString
}

type DateInput = Date | ArchiveDateString | string | dayjs.Dayjs

export const parseArchivalDate = (dateInput: DateInput): dayjs.Dayjs => {
    if (typeof dateInput === "string") {
        if (dateInput.length === ARCHIVE_DATE_TIME_FORMAT.length)
            return dayjs.utc(dateInput, ARCHIVE_DATE_TIME_FORMAT)
        else return dayjs.utc(dateInput)
    }
    return dayjs.utc(dateInput)
}

export const formatAsArchivalDate = (date: dayjs.Dayjs): ArchiveDateString =>
    date.format(ARCHIVE_DATE_TIME_FORMAT) as ArchiveDateString

export const convertToArchivalDateStringIfNecessary = (
    dateInput: DateInput
): ArchiveDateString => {
    if (
        typeof dateInput === "string" &&
        dateInput.length === ARCHIVE_DATE_TIME_FORMAT.length
    )
        return dateInput as ArchiveDateString

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
