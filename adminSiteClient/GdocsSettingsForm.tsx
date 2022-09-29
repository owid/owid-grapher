import React from "react"
import { GdocsErrorHelp } from "./GdocsErrorHelp.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faEdit } from "@fortawesome/free-solid-svg-icons/faEdit"
import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons/faCircleQuestion"
import { OwidArticleType } from "../clientUtils/owidTypes.js"
import {
    ErrorMessage,
    getPropertyMostCriticalError,
} from "./gdocsValidation.js"
import { GdocsSlug } from "./GdocsSlug.js"
import { Input, Tooltip } from "antd"

export const GdocsSettings = ({
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
            <div className="form-group">
                <label htmlFor="title">
                    Title{" "}
                    <Tooltip title="Editable in Google Docs">
                        <span>
                            <FontAwesomeIcon icon={faCircleQuestion} />
                        </span>
                    </Tooltip>
                </label>
                <Input
                    addonBefore="title:"
                    value={gdoc.content.title}
                    status={getPropertyMostCriticalError("title", errors)?.type}
                    id="title"
                    required
                    disabled={true}
                />
                <GdocsErrorHelp
                    error={getPropertyMostCriticalError("title", errors)}
                />
            </div>
            <div className="form-group">
                <GdocsSlug gdoc={gdoc} setGdoc={setGdoc} errors={errors} />
            </div>
        </form>
    ) : null
}
