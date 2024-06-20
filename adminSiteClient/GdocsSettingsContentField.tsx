import React from "react"
import { Input, InputProps } from "antd"
import {
    OwidGdocPostInterface,
    OwidGdocErrorMessage,
    OwidGdocErrorMessageType,
    OwidGdocDataInsightInterface,
    OwidGdocErrorMessageProperty,
    get,
    OwidGdocHomepageInterface,
    OwidGdocAuthorInterface,
    OwidGdocAnnouncementsInterface,
    OwidGdoc,
} from "@ourworldindata/utils"
import { GdocsEditLink } from "./GdocsEditLink.js"
import { GdocsErrorHelp } from "./GdocsErrorHelp.js"
import { getPropertyMostCriticalError } from "./gdocsValidation.js"
import { TextAreaProps } from "antd/lib/input/TextArea.js"
import { Help } from "./Forms.js"

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
    const value = get(gdoc, ["content", property])
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
