// Imports dayjs and loads the plugins we need. Then exports it with the correct types.

import dayjs, { Dayjs } from "dayjs"
import customParseFormat from "dayjs/plugin/customParseFormat.js"
import relativeTime from "dayjs/plugin/relativeTime.js"
import utc from "dayjs/plugin/utc.js"

dayjs.extend(customParseFormat)
dayjs.extend(relativeTime)
dayjs.extend(utc)

export default dayjs

// We need these explicit plugin type imports _and exports_ to get the right Dayjs type down the line
import type customParseFormatType from "dayjs/plugin/customParseFormat.js"
import type relativeTimeType from "dayjs/plugin/relativeTime.js"
import type utcType from "dayjs/plugin/utc.js"

export type { Dayjs, customParseFormatType, relativeTimeType, utcType }
