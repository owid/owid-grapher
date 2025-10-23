import * as _ from "lodash-es"
import * as React from "react"
import { Input, InputProps } from "antd"
import {
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocErrorMessageProperty,
    OwidGdoc,
} from "@ourworldindata/utils"
import { GdocsEditLink } from "./GdocsEditLink.js"
import { GdocsErrorHelp } from "./GdocsErrorHelp.js"
import { getPropertyMostCriticalError } from "./gdocsValidation.js"
import { TextAreaProps } from "antd/lib/input/TextArea.js"
import { Help } from "./Forms.js"
import { makeImageSrc } from "./imagesHelpers.js"

const FEATURED_IMAGE_PREVIEW_WIDTH = 768
const FEATURED_IMAGE_PROPERTY = "featured-image"

function getFeaturedImageSrc(
    gdoc: OwidGdoc,
    property: OwidGdocErrorMessageProperty,
    value: unknown
): string | undefined {
    if (property !== FEATURED_IMAGE_PROPERTY) return undefined
    if (typeof value !== "string" || value.length === 0) return undefined
    const featuredImageMetadata = gdoc.imageMetadata?.[value]
    if (!featuredImageMetadata?.cloudflareId) return undefined
    return makeImageSrc(
        featuredImageMetadata.cloudflareId,
        FEATURED_IMAGE_PREVIEW_WIDTH
    )
}

export const GdocsSettingsContentField = ({
    gdoc,
    property,
    render = (props) => <GdocsSettingsTextField {...props} />,
    errors,
    description,
}: {
    gdoc: OwidGdoc
    property: OwidGdocErrorMessageProperty
    render?: (props: {
        name: string
        value: string
        errorType?: OwidGdocErrorMessageType
    }) => React.ReactElement
    errors?: OwidGdocErrorMessage[]
    description?: string
}) => {
    const error = getPropertyMostCriticalError(property, errors)
    const value = _.get(gdoc, ["content", property])
    const featuredImageSrc = getFeaturedImageSrc(gdoc, property, value)

    return (
        <div className="form-group">
            <label htmlFor={property}>
                <span className="text-capitalize">{property}</span>
            </label>
            <div className="edit-in-gdocs">
                <GdocsEditLink gdocId={gdoc.id} />
                {render({
                    name: property,
                    value,
                    errorType: error?.type,
                })}
            </div>
            {featuredImageSrc ? (
                <div className="GdocsSettingsContentField__imagePreview">
                    <img
                        className="GdocsSettingsContentField__imagePreviewImage"
                        src={featuredImageSrc}
                        alt=""
                    />
                </div>
            ) : null}
            <GdocsErrorHelp error={error} />
            {description ? <Help>{description}</Help> : null}
        </div>
    )
}

export const GdocsSettingsTextField = ({
    name,
    value,
    errorType,
    inputProps,
}: {
    name: string
    value: string
    errorType?: OwidGdocErrorMessageType
    inputProps?: InputProps
}) => (
    <Input
        addonBefore={`${name}:`}
        value={value}
        status={errorType}
        id={name}
        readOnly
        {...inputProps}
    />
)

export const GdocsSettingsTextArea = ({
    name,
    value,
    errorType,
    inputProps,
}: {
    name: string
    value: string
    errorType?: OwidGdocErrorMessageType
    inputProps?: TextAreaProps
}) => (
    <Input.TextArea
        value={value}
        status={errorType}
        id={name}
        readOnly
        {...inputProps}
    />
)
