import React from "react"
import {
    OwidGdocPostInterface,
    OwidGdocErrorMessage,
    OwidGdocDataInsightInterface,
} from "@ourworldindata/utils"
import { EXCERPT_MAX_LENGTH } from "./gdocsValidation.js"
import { GdocsSlug } from "./GdocsSlug.js"
import {
    GdocsSettingsContentField,
    GdocsSettingsTextArea,
} from "./GdocsSettingsContentField.js"
import { GdocsPublishedAt } from "./GdocsDateline.js"
import { GdocsPublicationContext } from "./GdocsPublicationContext.js"
import { Alert, Col, Row } from "antd"
import { GdocsBreadcrumbsInput } from "./GdocsBreadcrumbsInput.js"

export const GdocPostSettings = ({
    gdoc,
    setCurrentGdoc,
    errors,
}: {
    gdoc: OwidGdocPostInterface
    setCurrentGdoc: (gdoc: OwidGdocPostInterface) => void
    errors?: OwidGdocErrorMessage[]
}) => {
    // Show errors at the top of the drawer for errors that don't have specific fields
    const errorsToShowInDrawer = (errors || []).filter(
        ({ property }) =>
            ![
                "title",
                "excerpt",
                "authors",
                "cover-image",
                "featured-image",
                "atom-title",
                "atom-excerpt",
            ].includes(property)
    )

    return gdoc ? (
        <form className="GdocsSettingsForm">
            {errorsToShowInDrawer.length ? (
                <div className="form-group">
                    {errorsToShowInDrawer.map((error) => (
                        <Alert
                            message={error.message}
                            type={error.type}
                            key={error.message}
                            className="GdocsSettingsForm__alert"
                            showIcon
                        />
                    ))}
                </div>
            ) : null}
            <GdocsSettingsContentField
                property="title"
                gdoc={gdoc}
                errors={errors}
            />
            <GdocsSettingsContentField
                property="excerpt"
                gdoc={gdoc}
                errors={errors}
                render={(props) => (
                    <GdocsSettingsTextArea
                        {...props}
                        inputProps={{
                            showCount: true,
                            maxLength: EXCERPT_MAX_LENGTH,
                        }}
                    />
                )}
            />
            <div className="form-group">
                <GdocsSlug
                    gdoc={gdoc}
                    setCurrentGdoc={setCurrentGdoc}
                    errors={errors}
                />
            </div>
            <GdocsSettingsContentField
                property="authors"
                gdoc={gdoc}
                errors={errors}
            />
            <GdocsSettingsContentField
                property="cover-image"
                gdoc={gdoc}
                errors={errors}
            />
            <GdocsSettingsContentField
                property="featured-image"
                gdoc={gdoc}
                errors={errors}
            />
            <div className="form-group">
                <Row gutter={24}>
                    <Col span={16}>
                        <GdocsSettingsContentField
                            property="dateline"
                            gdoc={gdoc}
                            errors={errors}
                        />
                    </Col>
                    <GdocsPublishedAt
                        gdoc={gdoc}
                        setCurrentGdoc={setCurrentGdoc}
                        errors={errors}
                    />
                </Row>
            </div>
            <div className="form-group">
                <GdocsPublicationContext
                    gdoc={gdoc}
                    setCurrentGdoc={setCurrentGdoc}
                />
                <GdocsSettingsContentField
                    property="atom-title"
                    gdoc={gdoc}
                    errors={errors}
                    description="An optional property to override the title of this post in our atom feed, which is used for the newsletter"
                />
                <GdocsSettingsContentField
                    property="atom-excerpt"
                    gdoc={gdoc}
                    errors={errors}
                    description="An optional property to override the excerpt of this post in our atom feed, which is used for the newsletter"
                />
            </div>
            <GdocsBreadcrumbsInput
                gdoc={gdoc}
                errors={errors}
                setCurrentGdoc={setCurrentGdoc}
            />
        </form>
    ) : null
}

export const GdocsInsightSettings = ({
    gdoc,
    setCurrentGdoc,
    errors,
}: {
    gdoc: OwidGdocDataInsightInterface
    setCurrentGdoc: (gdoc: OwidGdocDataInsightInterface) => void
    errors?: OwidGdocErrorMessage[]
}) => {
    // Show errors at the top of the drawer for errors that don't have specific fields
    const errorsToShowInDrawer = (errors || []).filter(
        ({ property }) =>
            ![
                "title",
                "authors",
                "approvedBy",
                "grapherSlug",
                "slug",
                "publishedAt",
            ].includes(property)
    )

    return gdoc ? (
        <form className="GdocsSettingsForm">
            {errorsToShowInDrawer.length ? (
                <div className="form-group">
                    {errorsToShowInDrawer.map((error) => (
                        <Alert
                            message={error.message}
                            type={error.type}
                            key={error.message}
                            className="GdocsSettingsForm__alert"
                            showIcon
                        />
                    ))}
                </div>
            ) : null}
            <GdocsSettingsContentField
                property="title"
                gdoc={gdoc}
                errors={errors}
            />
            <GdocsSettingsContentField
                property="approvedBy"
                gdoc={gdoc}
                errors={errors}
            />
            <GdocsSettingsContentField
                property="grapherSlug"
                gdoc={gdoc}
                errors={errors}
            />
            <div className="form-group">
                <GdocsSlug
                    gdoc={gdoc}
                    setCurrentGdoc={setCurrentGdoc}
                    errors={errors}
                />
            </div>
            <GdocsSettingsContentField
                property="authors"
                gdoc={gdoc}
                errors={errors}
            />
            <div className="form-group">
                <GdocsPublishedAt
                    gdoc={gdoc}
                    setCurrentGdoc={setCurrentGdoc}
                    errors={errors}
                />
            </div>
        </form>
    ) : null
}
