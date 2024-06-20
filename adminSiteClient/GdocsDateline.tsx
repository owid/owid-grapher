import { Col, DatePicker } from "antd"
import { Dayjs } from "dayjs"
import { dayjs, OwidGdocErrorMessage, OwidGdoc } from "@ourworldindata/utils"
import React from "react"
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
        setCurrentGdoc({
            ...gdoc,
            publishedAt: publishedAt?.toDate() || null,
        })
    }

    const publishedAtError = getPropertyMostCriticalError("publishedAt", errors)

    return (
        <Col span={8}>
            <label htmlFor="publishedAt">Publication date</label>
            <DatePicker
                onChange={onChangePublishedAt}
                value={publishedAt ? dayjs(publishedAt) : undefined}
                format="ddd, MMM D, YYYY"
                id="publishedAt"
                status={publishedAtError?.type}
                // The "Today" button has been disabled because it sets
                // the time to the current time. This time change makes
                // it all the way to the atom feed, which is then
                // interpreted by MailChimp's RSS-to-Email as a new
                // article.
                showToday={false}
            />
            <GdocsErrorHelp
                error={publishedAtError}
                help={
                    "Used in default dateline. Visible in the citation block. Also used to sort articles in lists."
                }
            />
        </Col>
    )
}
