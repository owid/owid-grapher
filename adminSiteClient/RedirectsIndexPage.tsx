import { useCallback, useContext, useEffect, useMemo, useState } from "react"
import { AdminLayout } from "./AdminLayout.js"
import { FieldsRow } from "./Forms.js"
import { Link } from "./Link.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { Button, Table, TableColumnsType } from "antd"

interface RedirectListItem {
    id: number
    slug: string
    chartId: number
    chartSlug: string
    targetQueryParam: string | null
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

    const columns: TableColumnsType<RedirectListItem> = useMemo(
        () => [
            {
                title: "Slug",
                dataIndex: "slug",
                sorter: (a, b) => a.slug.localeCompare(b.slug),
            },
            {
                title: "Redirects To",
                key: "target",
                render: (_, redirect) => (
                    <Link to={`/charts/${redirect.chartId}/edit`}>
                        {redirect.chartSlug}
                        {redirect.targetQueryParam
                            ? `?${redirect.targetQueryParam}`
                            : ""}
                    </Link>
                ),
            },
            {
                title: "",
                key: "delete",
                render: (_, redirect) => (
                    <Button
                        color="danger"
                        variant="solid"
                        onClick={() => onDelete(redirect)}
                    >
                        Delete
                    </Button>
                ),
            },
        ],
        [onDelete]
    )

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
                <Table
                    size="small"
                    rowKey={(redirect) => redirect.id}
                    dataSource={redirects}
                    pagination={false}
                    columns={columns}
                />
            </main>
        </AdminLayout>
    )
}
