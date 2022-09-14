import React, { useContext, useEffect } from "react"
import { AdminLayout } from "./AdminLayout.js"
import { FieldsRow, Modal, SearchField } from "./Forms.js"
import { faCirclePlus } from "@fortawesome/free-solid-svg-icons/faCirclePlus"
import { faCloudArrowUp } from "@fortawesome/free-solid-svg-icons/faCloudArrowUp"
import { faGear } from "@fortawesome/free-solid-svg-icons/faGear"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { OwidArticleType } from "../clientUtils/owidTypes.js"
import { Route, RouteComponentProps } from "react-router-dom"
import { Link } from "./Link.js"
import { GdocsAdd } from "./GdocsAdd.js"

interface GdocsMatchParams {
    id: string
}

export type GdocsMatchProps = RouteComponentProps<GdocsMatchParams>

export const GdocsIndexPage = ({ match, history }: GdocsMatchProps) => {
    const [gdocs, setGdocs] = React.useState<OwidArticleType[]>([])

    const { admin } = useContext(AdminAppContext)

    useEffect(() => {
        const fetchGodcs = async () => {
            const gdocs = (await admin.getJSON(
                "/api/gdocs"
            )) as OwidArticleType[]
            setGdocs(gdocs)
        }
        fetchGodcs()
    }, [admin])

    const onAdd = async (id: string) => {
        const gdoc = (await admin.requestJSON(
            `/api/gdocs/${id}`,
            {},
            "PUT"
        )) as OwidArticleType
        setGdocs([...gdocs, gdoc])

        history.push(`/gdocs/${id}/edit`)
    }

    return (
        <AdminLayout title="Google Docs">
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
                        onClick={() => history.push(`${match.url}/add`)}
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
                    <tbody>
                        {gdocs.map((gdoc) => (
                            <tr key={gdoc.slug}>
                                <td>{gdoc.title}</td>
                                <td>{gdoc.slug}</td>
                                <td>Type</td>
                                <td>Status</td>
                                <td>Tags</td>
                                <td>Last Updated</td>
                                <td>
                                    <button>
                                        <FontAwesomeIcon
                                            icon={faCloudArrowUp}
                                        />
                                        Publish
                                    </button>
                                    <Link
                                        to={`${match.url}/${gdoc.id}/settings`}
                                    >
                                        <FontAwesomeIcon icon={faGear} />
                                        Settings
                                    </Link>
                                    <Link
                                        to={`${match.url}/${gdoc.id}/edit`}
                                        className="btn btn-primary"
                                    >
                                        Edit
                                    </Link>
                                </td>
                            </tr>
                        ))}
                        {/* {postsToShow.map((post) => (
                                <PostRow
                                    key={post.id}
                                    post={post}
                                    highlight={highlight}
                                    availableTags={this.availableTags}
                                />
                            ))} */}
                    </tbody>
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

            <Route
                path={`${match.path}/add`}
                render={() => {
                    const onClose = () => history.push(match.url)

                    return (
                        <Modal onClose={onClose}>
                            <GdocsAdd onAdd={onAdd} />
                        </Modal>
                    )
                }}
            />
        </AdminLayout>
    )
}
