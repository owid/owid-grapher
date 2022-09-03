import React from "react"
import { AdminLayout } from "./AdminLayout.js"
import { FieldsRow, Modal, SearchField } from "./Forms.js"
import { faCirclePlus } from "@fortawesome/free-solid-svg-icons/faCirclePlus"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"

export const GdocsIndexPage = () => {
    const [showModal, setShowModal] = React.useState(false)
    const [responseSuccess, setResponseSuccess] = React.useState(false)
    const [documentUrl, setDocumentUrl] = React.useState("")

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setResponseSuccess(true)
    }

    return (
        <AdminLayout title="Google Docs Articles">
            <main>
                <FieldsRow>
                    <span>
                        {/* Showing {postsToShow.length} of {numTotalRows} posts */}
                    </span>
                    {/* <SearchField
                            placeholder="Search all posts..."
                            value={searchInput}
                            onValue={this.onSearchInput}
                            autofocus
                        /> */}
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowModal(true)}
                    >
                        <FontAwesomeIcon icon={faCirclePlus} /> Add document
                    </button>
                </FieldsRow>
                <table className="table table-bordered">
                    <thead>
                        <tr>
                            <th>Title</th>
                            <th>Authors</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th>Tags</th>
                            <th>Last Updated</th>
                            <th></th>
                        </tr>
                    </thead>
                    {/* <tbody>
                            {postsToShow.map((post) => (
                                <PostRow
                                    key={post.id}
                                    post={post}
                                    highlight={highlight}
                                    availableTags={this.availableTags}
                                />
                            ))}
                        </tbody> */}
                </table>
                {/* {!searchInput && (
                        <button
                            className="btn btn-secondary"
                            onClick={this.onShowMore}
                        >
                            Show more posts...
                        </button>
                    )} */}
            </main>
            {showModal && (
                <Modal
                    onClose={() => setShowModal(false)}
                    className="ModalAddGdoc"
                >
                    <form onSubmit={onSubmit}>
                        <div className="modal-header">
                            <h5 className="modal-title">Add a document</h5>
                        </div>
                        <div className="modal-body">
                            <ol>
                                <li>Make a copy of this Google Doc.</li>
                                <li>Edit the title</li>
                                <li>
                                    Add xxx@yy.iam.gserviceaccount.com as an
                                    editor
                                </li>
                                <li>
                                    Fill in the URL of your Doc in the field
                                    below 👇
                                </li>
                            </ol>
                            <div className="form-group">
                                <input
                                    type="string"
                                    className="form-control"
                                    onChange={(e) =>
                                        setDocumentUrl(e.target.value)
                                    }
                                    value={documentUrl}
                                    required
                                    placeholder="Document URL"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <input
                                type="submit"
                                className="btn btn-primary"
                                value="Add document"
                            />
                        </div>
                        {responseSuccess && (
                            <div className="alert alert-success" role="alert">
                                Document added successfully!
                            </div>
                        )}
                    </form>
                </Modal>
            )}
        </AdminLayout>
    )
}
