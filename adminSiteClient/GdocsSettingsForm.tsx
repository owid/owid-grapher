import React from "react"
import {
    OwidGdocInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
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
    setGdoc,
    errors,
}: {
    gdoc: OwidGdocInterface
    setGdoc: (gdoc: OwidGdocInterface) => void
    errors?: OwidGdocErrorMessage[]
}) => {
    const attachmentMessages = errors?.filter((error) =>
        ["linkedDocuments", "imageMetadata", "content"].includes(error.property)
    )
    const attachmentErrors =
        attachmentMessages?.filter(
            ({ type }) => type === OwidGdocErrorMessageType.Error
        ) ?? []
    const attachmentWarnings =
        attachmentMessages?.filter(
            ({ type }) => type === OwidGdocErrorMessageType.Warning
        ) ?? []

    return gdoc ? (
        <form className="GdocsSettingsForm">
            <GdocsSettingsContentField
                property="title"
                gdoc={gdoc}
                errors={errors}
            />
            <div className="form-group">
                <GdocsSlug gdoc={gdoc} setGdoc={setGdoc} errors={errors} />
            </div>
            <GdocsSettingsContentField
                property="byline"
                gdoc={gdoc}
                errors={errors}
            />
            <GdocsSettingsContentField
                property="cover"
                gdoc={gdoc}
                errors={errors}
            />
            <div className="form-group">
                <GdocsDateline gdoc={gdoc} setGdoc={setGdoc} errors={errors} />
            </div>
            <div className="form-group">
                <GdocsPublicationContext gdoc={gdoc} setGdoc={setGdoc} />
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
                {attachmentErrors.length ? (
                    <>
                        <p>Document errors</p>
                        <ul>
                            {attachmentErrors?.map((error) => (
                                <li key={error.message}>{error.message}</li>
                            ))}
                        </ul>
                    </>
                ) : null}
                {attachmentWarnings.length ? (
                    <>
                        <p>Document warnings</p>
                        <ul>
                            {attachmentWarnings?.map((error) => (
                                <li key={error.message}>{error.message}</li>
                            ))}
                        </ul>
                    </>
                ) : null}
            </div>
        </form>
    ) : null
}
