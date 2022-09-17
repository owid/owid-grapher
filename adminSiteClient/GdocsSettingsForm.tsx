import React, { useContext } from "react"
import { AdminAppContext } from "./AdminAppContext.js"
import { Help } from "./Forms.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faEdit } from "@fortawesome/free-solid-svg-icons/faEdit"
import {
    GdocsPatch,
    GdocsPatchOp,
    OwidArticleType,
} from "../clientUtils/owidTypes.js"
import {
    ErrorMessage,
    ErrorMessageType,
    getErrors,
    getPropertyValidationStatus,
} from "./gdocsValidation.js"
import { GdocsSlug } from "./GdocsSlug.js"
import { Input } from "antd"

export const GdocsSettings = ({
    gdoc,
    setGdoc,
    onSuccess,
    errors,
}: {
    gdoc: OwidArticleType
    setGdoc: (gdoc: OwidArticleType) => void
    onSuccess: VoidFunction
    errors?: ErrorMessage[]
}) => {
    const { admin } = useContext(AdminAppContext)

    const isValid = gdoc
        ? !getErrors(gdoc).some(
              (error) => error.type === ErrorMessageType.Error
          )
        : false

    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        if (!gdoc || !isValid) return

        const gdocsPatches: GdocsPatch[] = [
            { op: GdocsPatchOp.Update, property: "title", payload: gdoc.title },
            { op: GdocsPatchOp.Update, property: "slug", payload: gdoc.slug },
        ]

        await admin.requestJSON(`/api/gdocs/${gdoc.id}`, gdocsPatches, "PATCH")
        onSuccess()
    }

    return gdoc ? (
        <form className="GdocsSettingsForm" onSubmit={onSubmit}>
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
                <label htmlFor="title">Title</label>
                <Input
                    value={gdoc.title}
                    onChange={(e) =>
                        setGdoc({ ...gdoc, title: e.target.value })
                    }
                    status={getPropertyValidationStatus("title", errors)}
                    id="title"
                    required
                />
                <Help>The document title as it will appear on the site.</Help>
            </div>
            <div className="form-group">
                <GdocsSlug gdoc={gdoc} setGdoc={setGdoc} errors={errors} />
            </div>
            <div className="d-flex justify-content-end">
                <button disabled={!isValid} className="btn btn-primary">
                    Save and publish
                </button>
            </div>
        </form>
    ) : null
}
