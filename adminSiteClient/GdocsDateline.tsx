import { Col, DatePicker } from "antd"
import { Dayjs } from "dayjs"
import { dayjs, OwidGdocErrorMessage, OwidGdoc } from "@ourworldindata/utils"
import React from "react"
import { PUBLISHED_AT_FORMAT } from "../settings/clientSettings"
import { getPropertyMostCriticalError } from "./gdocsValidation.js"
import { GdocsErrorHelp } from "./GdocsErrorHelp.js"

export const GdocsPublishedAt = <T extends OwidGdoc>({
    gdoc,
    setCurrentGdoc,
    errors,
}: {
    gdoc: T
    setCurrentGdoc: (gdoc: T) => void
    errors?: OwidGdocErrorMessage[]
}) => {
    const { publishedAt } = gdoc

    const onChangePublishedAt = (publishedAt: Dayjs | null) => {
        if (!publishedAt) {
            setCurrentGdoc({ ...gdoc, publishedAt: null })
            return
        }
        // If gdoc.publishedAt is null, it means the user has cleared the datepicker,
        // which means the incoming publishedAt has been initialized by the datepicker,
        // which is based on the user's timezone.
        // e.g. the user is in UTC-4, and they select 09:00:00 through the datepicker:
        // the incoming publishedAt will be 13:00:00 (UTC)
        // but we want it to be 09:00:00 (UTC) because we want authors to always think in UTC
        // so we need to offset the incoming publishedAt by the user's timezone.
        // This isn't an issue when gdoc.publishedAt is not null: in that case, we pass a dayjs object to the datepicker
        // that is already set to UTC.
        if (gdoc.publishedAt === null) {
            const offsetPublishedAt = publishedAt.add(
                dayjs().utcOffset(),
                "minute"
            )
            setCurrentGdoc({
                ...gdoc,
                publishedAt: offsetPublishedAt.toDate(),
            })
        } else {
            setCurrentGdoc({
                ...gdoc,
                publishedAt: publishedAt.toDate(),
            })
        }
    }

    const publishedAtError = getPropertyMostCriticalError("publishedAt", errors)

    return (
        <Col span={8}>
            <label htmlFor="publishedAt">Publication date</label>
            <DatePicker
                onChange={onChangePublishedAt}
                value={publishedAt ? dayjs(publishedAt).utc() : null}
                format={PUBLISHED_AT_FORMAT}
                id="publishedAt"
                status={publishedAtError?.type}
                showTime
                // The "Now" button has been disabled because it sets
                // the time to the current time. This time change makes
                // it all the way to the atom feed, which is then
                // interpreted by MailChimp's RSS-to-Email as a new
                // article.
                showNow={false}
            />
            <GdocsErrorHelp
                error={publishedAtError}
                help={
                    "UTC. Used in default dateline. Visible in the citation block. Also used to sort articles in lists."
                }
            />
        </Col>
    )
}
