import React from "react"
import { OwidGdocInterface, OwidGdocErrorMessage } from "@ourworldindata/utils"
import { ExcerptHandler } from "./gdocsValidation.js"
import { GdocsSlug } from "./GdocsSlug.js"
import {
    GdocsSettingsContentField,
    GdocsSettingsTextArea,
} from "./GdocsSettingsContentField.js"
import { GdocsDateline } from "./GdocsDateline.js"
import { GdocsPublicationContext } from "./GdocsPublicationContext.js"
import { Alert } from "antd"
import { GdocsBreadcrumbsInput } from "./GdocsBreadcrumbsInput.js"

export const GdocsSettingsForm = ({
    gdoc,
    setCurrentGdoc,
    errors,
}: {
    gdoc: OwidGdocInterface
    setCurrentGdoc: (gdoc: OwidGdocInterface) => void
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
                            maxLength: ExcerptHandler.maxLength,
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
                <GdocsDateline
                    gdoc={gdoc}
                    setCurrentGdoc={setCurrentGdoc}
                    errors={errors}
                />
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
