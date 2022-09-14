import React from "react"

export const GdocsAdd = ({
    onAdd,
}: {
    onAdd: (id: string) => Promise<void>
}) => {
    const [documentUrl, setDocumentUrl] = React.useState("")

    const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        const regex = /https:\/\/docs\.google\.com\/document\/d\/([^\/]+)\/edit/

        const match = documentUrl.match(regex)

        // handled by HTML5 validation below
        if (!match) return

        const id = match[1]

        onAdd(id)
    }
    return (
        <form className="GdocsAddForm" onSubmit={onSubmit}>
            <div className="modal-header">
                <h5 className="modal-title">Add a document</h5>
            </div>
            <div className="modal-body">
                <ol>
                    <li>Make a copy of this Google Doc.</li>
                    <li>Edit the title</li>
                    <li>Add xxx@yy.iam.gserviceaccount.com as an editor</li>
                    <li>Fill in the URL of your Doc in the field below 👇</li>
                </ol>
                <div className="form-group">
                    <input
                        type="string"
                        className="form-control"
                        onChange={(e) => setDocumentUrl(e.target.value)}
                        value={documentUrl}
                        required
                        placeholder="https://docs.google.com/document/d/****/edit"
                        pattern="https:\/\/docs\.google\.com\/document\/d\/([^\/]+)\/edit"
                    />
                </div>
            </div>
            <div className="modal-footer">
                <button type="submit" className="btn btn-primary">
                    Add document
                </button>
            </div>
        </form>
    )
}
