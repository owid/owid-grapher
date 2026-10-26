import * as React from "react"
import { useMemo } from "react"
import { TableColumnsType } from "antd"
import { DbChartTagJoin } from "@ourworldindata/utils"

import { Link } from "./Link.js"
import { Timeago } from "./Forms.js"
import { EditableTags } from "./EditableTags.js"
import { AdminTable, AdminTableSearch } from "./AdminTable.js"
import { SearchHighlighter } from "./adminTableHelpers.js"
import { getTagGraphRolesById } from "./TagGraphMetadata.js"
import { useTags } from "./tagQueries.js"
import { DatasetListItem, useSetDatasetTags } from "./datasetQueries.js"

export type { DatasetListItem } from "./datasetQueries.js"

interface DatasetListProps {
    datasets: DatasetListItem[]
    searchHighlight?: SearchHighlighter
    search?: AdminTableSearch
    loading?: boolean
}

function createColumns({
    highlight,
    availableTags,
    tagGraphRolesById,
    onSaveTags,
}: {
    highlight: SearchHighlighter
    availableTags: ReturnType<typeof useTags>["data"]
    tagGraphRolesById: ReturnType<typeof getTagGraphRolesById>
    onSaveTags: (datasetId: number, tags: DbChartTagJoin[]) => Promise<void>
}): TableColumnsType<DatasetListItem> {
    return [
        {
            title: "Dataset",
            // antd lays the table out fixed once a column has `ellipsis`, and
            // the columns without a width then split what is left equally —
            // which left the dataset's name a hundred pixels wide
            width: "26%",
            dataIndex: "name",
            key: "name",
            sorter: (a, b) => a.name.localeCompare(b.name),
            render: (name, dataset) => (
                <>
                    {dataset.nonRedistributable ? (
                        <span className="text-secondary">
                            Non-redistributable:{" "}
                        </span>
                    ) : dataset.isPrivate ? (
                        <span className="text-secondary">Unpublished: </span>
                    ) : null}
                    <Link to={`/datasets/${dataset.id}`}>
                        {highlight(name)}
                    </Link>
                </>
            ),
        },
        {
            title: "Namespace",
            dataIndex: "namespace",
            key: "namespace",
            width: 120,
            sorter: (a, b) => a.namespace.localeCompare(b.namespace),
        },
        {
            title: "Short name",
            width: "14%",
            dataIndex: "shortName",
            key: "shortName",
            sorter: (a, b) =>
                (a.shortName ?? "").localeCompare(b.shortName ?? ""),
            render: (shortName) => highlight(shortName),
        },
        {
            title: "Version",
            dataIndex: "version",
            key: "version",
            width: 110,
            sorter: (a, b) => (a.version ?? "").localeCompare(b.version ?? ""),
        },
        {
            title: "Charts",
            dataIndex: "numCharts",
            key: "numCharts",
            width: 90,
            align: "right",
            sorter: (a, b) => a.numCharts - b.numCharts,
        },
        {
            title: "Uploaded",
            dataIndex: "dataEditedAt",
            key: "dataEditedAt",
            width: 170,
            sorter: (a, b) =>
                new Date(a.dataEditedAt).getTime() -
                new Date(b.dataEditedAt).getTime(),
            render: (dataEditedAt, dataset) => (
                <Timeago
                    time={dataEditedAt}
                    by={highlight(dataset.dataEditedByUserName)}
                />
            ),
        },
        {
            title: "Notes",
            width: "12%",
            dataIndex: "description",
            key: "description",
            ellipsis: true,
            render: (description) => highlight(description),
        },
        {
            title: "Tags",
            dataIndex: "tags",
            key: "tags",
            width: 240,
            render: (tags, dataset) => (
                <EditableTags
                    tags={tags}
                    suggestions={availableTags ?? []}
                    tagGraphRolesById={tagGraphRolesById}
                    onSave={(nextTags) => onSaveTags(dataset.id, nextTags)}
                    disabled={dataset.namespace !== "owid"}
                />
            ),
        },
    ]
}

export function DatasetList({
    datasets,
    searchHighlight,
    search,
    loading,
}: DatasetListProps): React.ReactElement {
    const { data: availableTags } = useTags()
    const { mutateAsync: setDatasetTags } = useSetDatasetTags()

    const columns = useMemo(() => {
        const highlight: SearchHighlighter =
            searchHighlight ?? ((text) => text ?? "")
        return createColumns({
            highlight,
            availableTags,
            tagGraphRolesById: getTagGraphRolesById(availableTags ?? []),
            onSaveTags: async (datasetId, tags) => {
                await setDatasetTags({ datasetId, tags })
            },
        })
    }, [searchHighlight, availableTags, setDatasetTags])

    return (
        <AdminTable
            columns={columns}
            // The tag cells can't render before the tag list has loaded, so
            // hold the rows back rather than rendering them tagless
            dataSource={availableTags ? datasets : []}
            loading={loading || !availableTags}
            search={search}
            entityName="datasets"
        />
    )
}
