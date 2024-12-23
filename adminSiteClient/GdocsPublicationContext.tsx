import { Col, Radio, RadioChangeEvent, Row } from "antd"
import {
    OwidGdocPublicationContext,
    OwidGdocPostInterface,
} from "@ourworldindata/utils"
import { GdocsErrorHelp } from "./GdocsErrorHelp.js"

export const GdocsPublicationContext = ({
    gdoc,
    setCurrentGdoc,
}: {
    gdoc: OwidGdocPostInterface
    setCurrentGdoc: (gdoc: OwidGdocPostInterface) => void
}) => {
    const { publicationContext } = gdoc

    const onChange = (e: RadioChangeEvent) => {
        setCurrentGdoc({
            ...gdoc,
            publicationContext: e.target.value,
        })
    }

    return (
        <>
            <Row>
                <Col>
                    <label htmlFor="publicationContext" className="mr-3">
                        Publication context
                    </label>
                    <Radio.Group
                        onChange={onChange}
                        value={publicationContext}
                        optionType="button"
                        id="publicationContext"
                    >
                        <Radio value={OwidGdocPublicationContext.unlisted}>
                            {OwidGdocPublicationContext.unlisted}
                        </Radio>
                        <Radio value={OwidGdocPublicationContext.listed}>
                            {OwidGdocPublicationContext.listed}
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
