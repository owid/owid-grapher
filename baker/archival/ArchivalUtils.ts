import { dayjs } from "@ourworldindata/utils"

export interface ArchivalTimestamp {
    date: Date
    formattedDate: string
}

const DATE_TIME_FORMAT = "YYYYMMDD-HHmmss"

export const getDateForArchival = (): ArchivalTimestamp => {
    const date = dayjs().utc()
    const formattedDate = date.format(DATE_TIME_FORMAT)

    return { date: date.toDate(), formattedDate }
}
