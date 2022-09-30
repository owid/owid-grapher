import React from "react"
import { GdocsErrorHelp } from "./GdocsErrorHelp.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faEdit } from "@fortawesome/free-solid-svg-icons/faEdit"
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons/faCircleQuestion"
import {
    OwidArticleContent,
    OwidArticleType,
} from "../clientUtils/owidTypes.js"
import {
    ErrorMessage,
    getPropertyMostCriticalError,
} from "./gdocsValidation.js"
import { GdocsSlug } from "./GdocsSlug.js"
import { Input, Tooltip } from "antd"

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
            <p>
                <a
                    href={`https://docs.google.com/document/d/${gdoc.id}/edit`}
                    target="_blank"
                    rel="noopener"
                >
                    <FontAwesomeIcon icon={faEdit} /> Edit document
                </a>
            </p>
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
                <span className="text-capitalize">{property}</span>{" "}
                <Tooltip title="Editable in Google Docs">
                    <span>
                        <FontAwesomeIcon icon={faCircleQuestion} />
                    </span>
                </Tooltip>
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
