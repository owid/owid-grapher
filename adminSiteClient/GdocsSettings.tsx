import React, { useContext, useEffect } from "react"
import { AdminAppContext } from "./AdminAppContext.js"
import { TextField } from "./Forms.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { faEdit } from "@fortawesome/free-solid-svg-icons/faEdit"
import { GdocsPatch, GdocsPatchOp } from "../clientUtils/owidTypes.js"

export const GdocsSettings = ({
    id,
    onClose,
    onSaveSettings,
}: {
    id: string
    onClose: VoidFunction
    onSaveSettings: (id: string, gdocsPatches: GdocsPatch[]) => Promise<void>
}) => {
    const [title, setTitle] = React.useState("")

    const { admin } = useContext(AdminAppContext)

    useEffect(() => {
        const fetchData = async () => {
            const gdoc = await admin.getJSON(`/api/gdocs/${id}`)
            setTitle(gdoc.title)
        }
        fetchData()
    }, [admin, id])

    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        const gdocsPatches: GdocsPatch[] = [
            { op: GdocsPatchOp.Update, property: "title", payload: title },
        ]
        onSaveSettings(id, gdocsPatches)
    }
    return (
        <form className="GdocsSettingsForm" onSubmit={onSubmit}>
            <div className="modal-header">
                <h5 className="modal-title">Publication settings</h5>
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
                        value={title}
                        onValue={(title) => setTitle(title)}
                        placeholder="The world is awful. The world is much better. The world can be much better."
                        helpText="The document title as it will appear on the site."
                        softCharacterLimit={50}
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
                <button className="btn btn-primary">Save</button>
            </div>
        </form>
    )
}
