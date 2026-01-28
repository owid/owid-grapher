import { useContext, useEffect, useMemo, useState } from "react"
import { RouteComponentProps } from "react-router-dom"
import { AdminAppContext } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { Spin } from "antd"

type CoverageEntity = { name: string; code: string }
type CoverageRow = { id: string; label: string }
type CoverageResponse = {
    rows: CoverageRow[]
    entities: CoverageEntity[]
    coverageByEntity: Record<string, Record<string, boolean>>
}

export const GdocsCoverageMatrixPage = ({
    match,
}: RouteComponentProps<{ id: string }>) => {
    const { admin } = useContext(AdminAppContext)
    const [data, setData] = useState<CoverageResponse | undefined>()
    const [error, setError] = useState<string | undefined>()
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let isMounted = true
        const fetchCoverage = async () => {
            try {
                const response = await admin.getJSON(
                    `/api/gdocs/${match.params.id}/coverage?contentSource=gdocs`
                )
                if (!isMounted) return
                setData(response as CoverageResponse)
            } catch (err) {
                if (!isMounted) return
                setError(String(err))
            } finally {
                if (isMounted) setIsLoading(false)
            }
        }

        void fetchCoverage()

        return () => {
            isMounted = false
        }
    }, [admin, match.params.id])

    const entityNames = useMemo(
        () => data?.entities.map((entity) => entity.name) ?? [],
        [data]
    )

    return (
        <AdminLayout title="Profile coverage matrix">
            <main className="GdocsCoverageMatrix">
                {isLoading && (
                    <div className="GdocsCoverageMatrix__loading">
                        <Spin />
                        <span>Loading coverage matrix…</span>
                    </div>
                )}
                {error && (
                    <div className="GdocsCoverageMatrix__error">{error}</div>
                )}
                {!isLoading && !error && data && data.rows.length === 0 && (
                    <div className="GdocsCoverageMatrix__empty">
                        No data-callout blocks found in this profile.
                    </div>
                )}
                {!isLoading && !error && data && data.rows.length > 0 && (
                    <div className="GdocsCoverageMatrix__table-wrapper">
                        <table className="GdocsCoverageMatrix__table">
                            <thead>
                                <tr>
                                    <th>Callout</th>
                                    {data.entities.map((entity) => (
                                        <th
                                            key={entity.code}
                                            title={entity.name}
                                        >
                                            {entity.code}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {data.rows.map((row) => (
                                    <tr key={row.id}>
                                        <td className="GdocsCoverageMatrix__label">
                                            <div title={row.label}>
                                                {row.label}
                                            </div>
                                        </td>
                                        {data.entities.map((entity) => {
                                            const isPresent =
                                                data.coverageByEntity[
                                                    entity.code
                                                ]?.[row.id] ?? false
                                            return (
                                                <td
                                                    key={`${row.id}-${entity.code}`}
                                                    className={
                                                        isPresent
                                                            ? "GdocsCoverageMatrix__cell GdocsCoverageMatrix__cell--present"
                                                            : "GdocsCoverageMatrix__cell GdocsCoverageMatrix__cell--missing"
                                                    }
                                                    title={
                                                        isPresent
                                                            ? `${entity.name}: data available`
                                                            : `${entity.name}: no data`
                                                    }
                                                />
                                            )
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {entityNames.length > 0 && (
                            <div className="GdocsCoverageMatrix__legend">
                                <span className="GdocsCoverageMatrix__legend-item">
                                    <span className="GdocsCoverageMatrix__cell GdocsCoverageMatrix__cell--present" />
                                    data available
                                </span>
                                <span className="GdocsCoverageMatrix__legend-item">
                                    <span className="GdocsCoverageMatrix__cell GdocsCoverageMatrix__cell--missing" />
                                    no data
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </AdminLayout>
    )
}
