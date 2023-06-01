import React from "react"
import {
    OwidGdocInterface,
    OwidGdocErrorMessage,
    groupBy,
} from "@ourworldindata/utils"
import { ExcerptHandler } from "./gdocsValidation.js"
import { GdocsSlug } from "./GdocsSlug.js"
import {
    GdocsSettingsContentField,
    GdocsSettingsTextArea,
} from "./GdocsSettingsContentField.js"
import { GdocsDateline } from "./GdocsDateline.js"
import { GdocsPublicationContext } from "./GdocsPublicationContext.js"

export const GdocsSettingsForm = ({
    gdoc,
    setCurrentGdoc,
    errors,
}: {
    gdoc: OwidGdocInterface
    setCurrentGdoc: (gdoc: OwidGdocInterface) => void
    errors?: OwidGdocErrorMessage[]
}) => {
    // These errors don't have a specific form field to render them in. We just show them at the bottom of the drawer
    const errorsToShowInDrawer = groupBy(
        (errors || []).filter(({ property }) =>
            [
                "content",
                "linkedDocuments",
                "linkedCharts",
                "details",
                "body",
            ].includes(property)
        ),
        "type"
    )

    return gdoc ? (
        <form className="GdocsSettingsForm">
            <GdocsSettingsContentField
                property="title"
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
            </div>
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
                {errorsToShowInDrawer.error?.length ? (
                    <>
                        <p>Document errors</p>
                        <ul>
                            {errorsToShowInDrawer.error.map((error) => (
                                <li key={error.message}>{error.message}</li>
                            ))}
                        </ul>
                    </>
                ) : null}
                {errorsToShowInDrawer.warning?.length ? (
                    <>
                        <p>Document warnings</p>
                        <ul>
                            {errorsToShowInDrawer.warning.map((error) => (
                                <li key={error.message}>{error.message}</li>
                            ))}
                        </ul>
                    </>
                ) : null}
            </div>
        </form>
    ) : null
}
