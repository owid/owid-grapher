import React from "react"
import { OwidArticleType } from "../clientUtils/owidTypes.js"
import { ErrorMessage } from "./gdocsValidation.js"
import { GdocsSlug } from "./GdocsSlug.js"
import { GdocsSettingsContentField } from "./GdocsSettingsContentField.js"
import { GdocsDateline } from "./GdocsDateline.js"

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

            <div className="form-group">
                <GdocsDateline gdoc={gdoc} setGdoc={setGdoc} errors={errors} />
            </div>
        </form>
    ) : null
}
