import React, { useContext, useEffect } from "react"
import { AdminAppContext } from "./AdminAppContext.js"
import { TextField } from "./Forms.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faEdit } from "@fortawesome/free-solid-svg-icons/faEdit"
import {
    GdocsPatch,
    GdocsPatchOp,
    OwidArticleType,
} from "../clientUtils/owidTypes.js"
import { ErrorMessage, ErrorMessageType, getErrors } from "./gdocsValidation.js"

export const GdocsSettings = ({
    id,
    onClose,
    onSaveSettings,
}: {
    id: string
    onClose: VoidFunction
    onSaveSettings: (id: string, gdocsPatches: GdocsPatch[]) => Promise<void>
}) => {
    const [gdoc, setGdoc] = React.useState<OwidArticleType>()
    const [errors, setErrors] = React.useState<ErrorMessage[]>()

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
        onSaveSettings(id, gdocsPatches)
        onClose()
    }

    useEffect(() => {
        const fetchGdoc = async () => {
            const gdoc = (await admin.getJSON(
                `/api/gdocs/${id}`
            )) as OwidArticleType
            setGdoc(gdoc)
        }
        fetchGdoc()
    }, [id, admin])

    useEffect(() => {
        if (!gdoc) return
        setErrors(getErrors(gdoc))
    }, [gdoc])

    return gdoc ? (
        <form className="GdocsSettingsForm" onSubmit={onSubmit}>
            <div className="modal-header">
                <h5 className="modal-title">Settings</h5>
            </div>
            <div className="modal-body">
                <div className="form-group">
                    <p>
                        <a
                            href={`https://docs.google.com/document/d/${id}/edit`}
                            target="_blank"
                            rel="noopener"
                        >
                            <FontAwesomeIcon icon={faEdit} /> Edit document
                        </a>
                    </p>
                    <TextField
                        label="Title"
                        value={gdoc.title}
                        onValue={(title) => setGdoc({ ...gdoc, title })}
                        placeholder="The world is awful. The world is much better. The world can be much better."
                        helpText="The document title as it will appear on the site."
                        softCharacterLimit={50}
                        required
                        errorMessage={
                            errors?.find((error) => error.property === "title")
                                ?.message
                        }
                    />
                    <TextField
                        label="Slug"
                        value={gdoc.slug}
                        onValue={(slug) => setGdoc({ ...gdoc, slug })}
                        placeholder="much-better-awful-can-be-better"
                        helpText={`https://ourworldindata.org/${
                            gdoc.slug ?? "[slug]"
                        }`}
                        softCharacterLimit={50}
                        required
                        errorMessage={
                            errors?.find((error) => error.property === "slug")
                                ?.message
                        }
                    />
                </div>
            </div>
            <div className="modal-footer">
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onClose}
                >
                    Cancel
                </button>
                <button disabled={!isValid} className="btn btn-primary">
                    Save
                </button>
            </div>
        </form>
    ) : null
}
