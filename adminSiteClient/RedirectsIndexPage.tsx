import { useCallback, useContext, useEffect, useState } from "react"
import { AdminLayout } from "./AdminLayout.js"
import { FieldsRow } from "./Forms.js"
import { Link } from "./Link.js"
import { AdminAppContext } from "./AdminAppContext.js"

interface RedirectListItem {
    id: number
    slug: string
    chartId: number
    chartSlug: string
}

interface RedirectRowProps {
    redirect: RedirectListItem
    onDelete: (redirect: RedirectListItem) => void
}

function RedirectRow({ redirect, onDelete }: RedirectRowProps) {
    return (
        <tr>
            <td>{redirect.slug}</td>
            <td>
                <Link to={`/charts/${redirect.chartId}/edit`}>
                    {redirect.chartSlug}
                </Link>
            </td>
            <td>
                <button
                    className="btn btn-danger"
                    onClick={() => onDelete(redirect)}
                >
                    Delete
                </button>
            </td>
        </tr>
    )
}

export function RedirectsIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [redirects, setRedirects] = useState<RedirectListItem[]>([])

    const onDelete = useCallback(
        async (redirect: RedirectListItem) => {
            if (
                !window.confirm(
                    `Delete the redirect from ${redirect.slug}? This action may break existing embeds!`
                )
            )
                return

            const json = await admin.requestJSON(
                `/api/redirects/${redirect.id}`,
                {},
                "DELETE"
            )

            if (json.success) {
                setRedirects((redirects) =>
                    redirects.filter(({ id }) => id !== redirect.id)
                )
            }
        },
        [admin]
    )

    useEffect(() => {
        const getData = async () => {
            const json = await admin.getJSON("/api/redirects.json")
            setRedirects(json.redirects)
        }
        void getData()
    }, [admin])

    return (
        <AdminLayout title="Chart Redirects">
            <main className="RedirectsIndexPage">
                <FieldsRow>
                    <span>Showing {redirects.length} redirects</span>
                </FieldsRow>
                <p>
                    Redirects are automatically created when the slug of a
                    published chart is changed.
                </p>
                <table className="table table-bordered">
                    <tbody>
                        <tr>
                            <th>Slug</th>
                            <th>Redirects To</th>
                            <th></th>
                        </tr>
                        {redirects.map((redirect) => (
                            <RedirectRow
                                key={redirect.id}
                                redirect={redirect}
                                onDelete={onDelete}
                            />
                        ))}
                    </tbody>
                </table>
            </main>
        </AdminLayout>
    )
}
