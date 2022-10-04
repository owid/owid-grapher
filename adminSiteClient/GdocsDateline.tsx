import { Col, Row } from "antd"
import { Dayjs } from "dayjs"
import dayjs from "../clientUtils/dayjs"
import React from "react"
import { OwidArticleType } from "../clientUtils/owidTypes.js"
import DatePicker from "./DatePicker.js"
import { GdocsSettingsContentField } from "./GdocsSettingsContentField.js"
import {
    ErrorMessage,
    getPropertyMostCriticalError,
} from "./gdocsValidation.js"
import { GdocsErrorHelp } from "./GdocsErrorHelp.js"

export const GdocsDateline = ({
    gdoc,
    setGdoc,
    errors,
}: {
    gdoc: OwidArticleType
    setGdoc: (gdoc: OwidArticleType) => void
    errors?: ErrorMessage[]
}) => {
    const { publishedAt } = gdoc

    const onChangePublishedAt = (publishedAt: Dayjs | null) => {
        setGdoc({
            ...gdoc,
            publishedAt: publishedAt?.utc(true).toDate() || null,
        })
    }

    const publishedAtError = getPropertyMostCriticalError("publishedAt", errors)

    return (
        <>
            <Row gutter={24}>
                <Col span={16}>
                    <GdocsSettingsContentField
                        property="dateline"
                        gdoc={gdoc}
                        errors={errors}
                    />
                </Col>
                <Col span={8}>
                    <label htmlFor="publishedAt">Publication date</label>
                    <DatePicker
                        onChange={onChangePublishedAt}
                        value={
                            publishedAt ? dayjs(publishedAt).utc() : undefined
                        }
                        format="ddd, MMM D, YYYY"
                        id="publishedAt"
                        status={publishedAtError?.type}
                    />
                    <GdocsErrorHelp
                        error={publishedAtError}
                        help={
                            "Used in default dateline. Visible in the citation block. Also used to sort articles in lists."
                        }
                    />
                </Col>
            </Row>
        </>
    )
}
