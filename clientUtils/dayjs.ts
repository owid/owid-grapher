// Imports dayjs and loads the plugins we need. Then exports it with the correct types.

import dayjs, { Dayjs } from "dayjs"
import utc from "dayjs/plugin/utc"
import relativeTime from "dayjs/plugin/relativeTime"

dayjs.extend(utc)
dayjs.extend(relativeTime)

export default dayjs

// We need these explicit plugin type imports _and exports_ to get the right Dayjs type down the line
import type utcType from "dayjs/plugin/utc"
import type relativeTimeType from "dayjs/plugin/relativeTime"

export type { Dayjs, utcType, relativeTimeType }
