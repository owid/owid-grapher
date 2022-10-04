import React from "react"
import { Input } from "antd"
import {
    OwidArticleType,
    OwidArticleContent,
} from "../clientUtils/owidTypes.js"
import { GdocsEditLink } from "./GdocsEditLink.js"
import { GdocsErrorHelp } from "./GdocsErrorHelp.js"
import {
    ErrorMessage,
    getPropertyMostCriticalError,
} from "./gdocsValidation.js"

export const GdocsSettingsContentField = ({
    gdoc,
    property,
    errors,
}: {
    gdoc: OwidArticleType
    property: keyof OwidArticleContent
    errors?: ErrorMessage[]
}) => {
    const error = getPropertyMostCriticalError(property, errors)
    return (
        <div className="form-group">
            <label htmlFor={property}>
                <span className="text-capitalize">{property}</span> [{" "}
                <GdocsEditLink gdoc={gdoc} style={{ fontSize: "O.8em" }} /> ]
            </label>
            <Input
                addonBefore={`${property}:`}
                value={gdoc.content[property]}
                status={error?.type}
                id={property}
                disabled={true}
            />
            <GdocsErrorHelp error={error} />
        </div>
    )
}
