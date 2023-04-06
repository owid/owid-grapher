import React, { useCallback, useContext, useEffect } from "react"
import { AdminLayout } from "./AdminLayout.js"
import { EditableTags, Modal } from "./Forms.js"
import { faCirclePlus } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome/index.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { OwidArticleTag, OwidArticleType } from "@ourworldindata/utils"
import { Route, RouteComponentProps } from "react-router-dom"
import { Link } from "./Link.js"
import { GdocsAdd } from "./GdocsAdd.js"
import { Observer } from "mobx-react"
import { useGdocsStore } from "./GdocsStore.js"
import { runInAction } from "mobx"
interface GdocsMatchParams {
    id: string
}

export type GdocsMatchProps = RouteComponentProps<GdocsMatchParams>

export const GdocsIndexPage = ({ match, history }: GdocsMatchProps) => {
    const { admin } = useContext(AdminAppContext)
    const store = useGdocsStore()

    useEffect(() => {
        const fetchGdocs = async () => {
            const gdocs = (await admin.getJSON(
                "/api/gdocs"
            )) as OwidArticleType[]

            runInAction(() => {
                store.gdocs = gdocs
            })
        }
        fetchGdocs()
    }, [admin, store])

    useEffect(() => {
        const fetchTags = async () => {
            const json = await admin.getJSON("/api/tags.json")
            runInAction(() => (store.availableTags = json.tags))
        }
        fetchTags()
    }, [admin, store])

    const updateTags = useCallback(
        async (gdoc: OwidArticleType, tags: OwidArticleTag[]) => {
            const json = await admin.requestJSON(
                `/api/gdocs/${gdoc.id}/setTags`,
                { tagIds: tags.map((t) => t.id) },
                "POST"
            )
            if (json.success) {
                const gdocToUpdate = store.gdocs.find((g) => g.id === gdoc.id)
                gdocToUpdate!.tags = tags
            }
        },
        [admin, store.gdocs]
    )

    return (
        <AdminLayout title="Google Docs">
            <Observer>
                {() => (
                    <main>
                        <div className="d-flex justify-content-between mb-3">
                            <span>
                                Showing {store.gdocs.length} Google Docs
                            </span>
                            <button
                                className="btn btn-primary"
                                onClick={() =>
                                    history.push(`${match.path}/add`)
                                }
                            >
                                <FontAwesomeIcon icon={faCirclePlus} /> Add
                                document
                            </button>
                        </div>
                        <table className="table table-bordered">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Slug</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Context</th>
                                    <th>Last Updated</th>
                                    <th>Categories</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {store.gdocs.map((gdoc) => (
                                    <tr key={gdoc.id}>
                                        <td>{gdoc.content.title}</td>
                                        <td>{gdoc.slug}</td>
                                        <td>Article</td>
                                        <td>
                                            {gdoc.published
                                                ? "Published"
                                                : "Draft"}
                                        </td>
                                        <td>{gdoc.publicationContext}</td>
                                        <td>{gdoc.updatedAt}</td>
                                        <td>
                                            {gdoc.tags ? (
                                                <EditableTags
                                                    tags={gdoc.tags}
                                                    onSave={(tags) =>
                                                        updateTags(
                                                            gdoc,
                                                            tags as any
                                                        )
                                                    }
                                                    suggestions={
                                                        store.availableTags
                                                    }
                                                />
                                            ) : null}
                                        </td>
                                        <td>
                                            <Link
                                                to={`${match.path}/${gdoc.id}/preview`}
                                                className="btn btn-primary"
                                            >
                                                Preview
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </main>
                )}
            </Observer>

            <Route
                path={`${match.path}/add`}
                render={() => {
                    const onClose = () => history.push(match.path)

                    return (
                        <Modal onClose={onClose}>
                            <GdocsAdd
                                onAdd={(id: string) => {
                                    history.push(`${match.path}/${id}/preview`)
                                }}
                            />
                        </Modal>
                    )
                }}
            />
        </AdminLayout>
    )
}
