import React from "react"
import { GdocsErrorHelp } from "./GdocsErrorHelp.js"
import {
    OwidArticleContent,
    OwidArticleType,
} from "../clientUtils/owidTypes.js"
import {
    ErrorMessage,
    getPropertyMostCriticalError,
} from "./gdocsValidation.js"
import { GdocsSlug } from "./GdocsSlug.js"
import { Input } from "antd"
import { GdocsEditLink } from "./GdocsEditLink.js"

export const GdocsSettingsForm = ({
    gdoc,
    setGdoc,
    errors,
}: {
    gdoc: OwidArticleType
    setGdoc: (gdoc: OwidArticleType) => void
    errors?: ErrorMessage[]
}) => {
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
        </form>
    ) : null
}

const GdocsSettingsContentField = ({
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
                <GdocsEditLink gdoc={gdoc} /> ]
            </label>
            <Input
                addonBefore={`${property}:`}
                value={gdoc.content[property]}
                status={error?.type}
                id={property}
                required
                disabled={true}
            />
            <GdocsErrorHelp error={error} />
        </div>
    )
}
