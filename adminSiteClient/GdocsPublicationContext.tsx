import { Col, Radio, RadioChangeEvent, Row } from "antd"
import {
    OwidArticlePublicationContext,
    OwidArticleType,
} from "@ourworldindata/utils"
import React from "react"
import { GdocsErrorHelp } from "./GdocsErrorHelp.js"

export const GdocsPublicationContext = ({
    gdoc,
    setGdoc,
}: {
    gdoc: OwidArticleType
    setGdoc: (gdoc: OwidArticleType) => void
}) => {
    const { publicationContext } = gdoc

    const onChange = (e: RadioChangeEvent) => {
        setGdoc({
            ...gdoc,
            publicationContext: e.target.value,
        })
    }

    return (
        <>
            <Row>
                <Col>
                    <label htmlFor="publishedAt" className="mr-3">
                        Publication context
                    </label>
                    <Radio.Group onChange={onChange} value={publicationContext}>
                        <Radio value={OwidArticlePublicationContext.unlisted}>
                            {OwidArticlePublicationContext.unlisted}
                        </Radio>
                        <Radio value={OwidArticlePublicationContext.listed}>
                            {OwidArticlePublicationContext.listed}
                        </Radio>
                    </Radio.Group>
                    <GdocsErrorHelp
                        help={
                            "Listed articles show up in the 'Latest' section of the homepage as well as the newsletter. Unlisted articles are not listed, but can still be accessed via the search bar and search engines."
                        }
                    />
                </Col>
            </Row>
        </>
    )
}
