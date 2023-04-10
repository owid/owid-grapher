import { Col, Radio, RadioChangeEvent, Row } from "antd"
import {
    OwidDocumentPublicationContext,
    OwidDocument,
} from "@ourworldindata/utils"
import React from "react"
import { GdocsErrorHelp } from "./GdocsErrorHelp.js"

export const GdocsPublicationContext = ({
    gdoc,
    setGdoc,
}: {
    gdoc: OwidDocument
    setGdoc: (gdoc: OwidDocument) => void
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
                    <Radio.Group
                        onChange={onChange}
                        value={publicationContext}
                        optionType="button"
                    >
                        <Radio value={OwidDocumentPublicationContext.unlisted}>
                            {OwidDocumentPublicationContext.unlisted}
                        </Radio>
                        <Radio value={OwidDocumentPublicationContext.listed}>
                            {OwidDocumentPublicationContext.listed}
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
