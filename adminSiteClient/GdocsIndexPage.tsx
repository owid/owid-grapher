import React, { useContext, useEffect } from "react"
import { AdminLayout } from "./AdminLayout.js"
import { FieldsRow, Modal, SearchField } from "./Forms.js"
import { faCirclePlus } from "@fortawesome/free-solid-svg-icons/faCirclePlus"
import { faCloudArrowUp } from "@fortawesome/free-solid-svg-icons/faCloudArrowUp"
import { faGear } from "@fortawesome/free-solid-svg-icons/faGear"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Gdoc } from "../clientUtils/owidTypes.js"
import { Route, RouteComponentProps } from "react-router-dom"
import { Link } from "./Link.js"
import { GdocsAdd } from "./GdocsAdd.js"
import { GdocsSettings } from "./GdocsSettings.js"

interface MatchParams {
    id: string
}

type MatchProps = RouteComponentProps<MatchParams>

export const GdocsIndexPage = ({ match, history }: MatchProps) => {
    const [gdocs, setGdocs] = React.useState<Gdoc[]>([])

    const { admin } = useContext(AdminAppContext)

    const validate = async (id: number) => {
        const json = await admin.getJSON(`/api/gdocs/${id}/validate`)

        // todo
        console.log(json)
    }

    useEffect(() => {
        const fetchGodcs = async () => {
            const gdocs = (await admin.getJSON("/api/gdocs")) as Gdoc[]
            setGdocs(gdocs)
        }
        fetchGodcs()
    }, [admin])

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
                                <td>
                                    {gdoc.slug}
                                    <button onClick={() => validate(gdoc.id)}>
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
                                </td>
                                <td>Authors</td>
                                <td>Type</td>
                                <td>Status</td>
                                <td>Tags</td>
                                <td>Last Updated</td>
                                <td></td>
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
                path={`${match.path}/:id/settings`}
                // "match" is from the parent route, and hence doesn't have the id
                // param
                render={({ match: localMatch }) => {
                    const onClose = () => history.push(match.url)
                    return (
                        <Modal onClose={onClose}>
                            <GdocsSettings
                                onClose={onClose}
                                id={localMatch.params.id}
                            />
                        </Modal>
                    )
                }}
            />
            <Route
                path={`${match.path}/add`}
                render={() => (
                    <Modal onClose={() => history.push(match.url)}>
                        <GdocsAdd />
                    </Modal>
                )}
            />
        </AdminLayout>
    )
}
