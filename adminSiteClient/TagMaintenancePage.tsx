import { useQuery } from "@tanstack/react-query"
import { useContext, useEffect, useMemo, useState } from "react"
import { Flex, Input, Table, TableColumnsType, Tag, Typography } from "antd"
import { AdminAppContext } from "./AdminAppContext.js"
import { AdminLayout } from "./AdminLayout.js"
import { Link } from "./Link.js"
import { Admin } from "./Admin.js"

type TagUsageRow = {
    id: number
    name: string
    slug: string | null
    searchableInAlgolia: number
    hasTopicPage: number
    topicPageCount: number
    topicPageSlugs: string | null
    inTagGraph: number
    publishedGdocCount: number
    unpublishedGdocCount: number
    publishedChartCount: number
    unpublishedChartCount: number
    activeDatasetCount: number
    archivedDatasetCount: number
    publishedExplorerCount: number
    unpublishedExplorerCount: number
}

type PresetKey =
    | "all"
    | "unused"
    | "onlyArchivedUnpublished"
    | "notInTagGraph"
    | "searchableButEmpty"
    | "contentButNotSearchable"
    | "slugMismatch"
    | "multipleTopicPages"

function hasAnyPublishedContent(tag: TagUsageRow): boolean {
    return (
        tag.publishedGdocCount > 0 ||
        tag.publishedChartCount > 0 ||
        tag.activeDatasetCount > 0 ||
        tag.publishedExplorerCount > 0
    )
}

function hasAnyAssociation(tag: TagUsageRow): boolean {
    return (
        tag.publishedGdocCount > 0 ||
        tag.unpublishedGdocCount > 0 ||
        tag.publishedChartCount > 0 ||
        tag.unpublishedChartCount > 0 ||
        tag.activeDatasetCount > 0 ||
        tag.archivedDatasetCount > 0 ||
        tag.publishedExplorerCount > 0 ||
        tag.unpublishedExplorerCount > 0
    )
}

function isSearchable(tag: TagUsageRow): boolean {
    return !!tag.searchableInAlgolia || !!tag.hasTopicPage
}

function hasSlugMismatch(tag: TagUsageRow): boolean {
    if (!tag.slug) return false
    // Tag has a slug but no associated topic page at all
    if (tag.topicPageCount === 0) return true
    // Tag has a slug and associated topic pages, but slug doesn't match any of them
    const associatedSlugs = tag.topicPageSlugs?.split(", ") ?? []
    return !associatedSlugs.includes(tag.slug)
}

const PRESETS: {
    key: PresetKey
    label: string
    description: string
    filter: (tag: TagUsageRow) => boolean
}[] = [
    {
        key: "all",
        label: "All",
        description: "Show all leaf tags",
        filter: () => true,
    },
    {
        key: "unused",
        label: "Unused",
        description:
            "Zero associations across all dimensions — safe delete candidates",
        filter: (tag) => !hasAnyAssociation(tag),
    },
    {
        key: "onlyArchivedUnpublished",
        label: "Only archived/unpublished",
        description:
            "Has associations, but all are unpublished or archived — effectively dead",
        filter: (tag) => hasAnyAssociation(tag) && !hasAnyPublishedContent(tag),
    },
    {
        key: "notInTagGraph",
        label: "Not in tag graph",
        description:
            "Not placed in the tag hierarchy — needs placement or cleanup",
        filter: (tag) => !tag.inTagGraph,
    },
    {
        key: "searchableButEmpty",
        label: "Searchable but empty",
        description:
            "Appears as a filter option in search (via Algolia flag or topic page) but has zero published content — leads to empty results",
        filter: (tag) => isSearchable(tag) && !hasAnyPublishedContent(tag),
    },
    {
        key: "contentButNotSearchable",
        label: "Content but not searchable",
        description:
            "Has published content but not searchable and no slug — users can't discover it",
        filter: (tag) => hasAnyPublishedContent(tag) && !isSearchable(tag),
    },
    {
        key: "slugMismatch",
        label: "Slug mismatch",
        description:
            "Tag slug doesn't match any of its associated topic page slugs, or has a slug but no associated topic page — the slug-based and tag-based relationships are out of sync",
        filter: (tag) => hasSlugMismatch(tag),
    },
    {
        key: "multipleTopicPages",
        label: "Multiple topic pages",
        description:
            "Slug matches more than one published topic page — should be a one-to-one relationship",
        filter: (tag) => tag.topicPageCount > 1,
    },
]

async function fetchTagUsageSummary(admin: Admin) {
    const { tags } = await admin.getJSON<{ tags: TagUsageRow[] }>(
        "/api/tags/usage-summary.json"
    )
    return tags
}

function renderCountWithSecondary(
    primary: number,
    secondary: number,
    secondaryLabel: string
): React.ReactNode {
    return (
        <>
            {primary}
            {secondary > 0 && (
                <span style={{ color: "#999", marginLeft: 4 }}>
                    +{secondary} {secondaryLabel}
                </span>
            )}
        </>
    )
}

function createColumns(): TableColumnsType<TagUsageRow> {
    return [
        {
            title: "Tag name",
            dataIndex: "name",
            key: "name",
            sorter: (a, b) => a.name.localeCompare(b.name),
            defaultSortOrder: "ascend",
            render: (name: string, record) => (
                <Link to={`/tags/${record.id}`}>{name}</Link>
            ),
        },
        {
            title: "Slug",
            dataIndex: "slug",
            key: "slug",
            render: (slug: string | null) =>
                slug ? (
                    <Typography.Text code>{slug}</Typography.Text>
                ) : (
                    <span style={{ color: "#ccc" }}>&mdash;</span>
                ),
        },
        {
            title: "Searchable",
            key: "searchable",
            width: 120,
            align: "center",
            sorter: (a, b) => {
                const aVal =
                    (a.searchableInAlgolia ? 1 : 0) + (a.hasTopicPage ? 2 : 0)
                const bVal =
                    (b.searchableInAlgolia ? 1 : 0) + (b.hasTopicPage ? 2 : 0)
                return aVal - bVal
            },
            render: (_, record) => {
                if (record.hasTopicPage) return "Topic page"
                if (record.searchableInAlgolia) return "Algolia"
                return <span style={{ color: "#ccc" }}>&mdash;</span>
            },
        },
        {
            title: "Topic pages",
            key: "topicPages",
            width: 200,
            sorter: (a, b) => a.topicPageCount - b.topicPageCount,
            render: (_, record) => {
                if (record.topicPageCount === 0)
                    return <span style={{ color: "#ccc" }}>&mdash;</span>
                const slugs = record.topicPageSlugs?.split(", ") ?? []
                const isMismatch = record.slug && !slugs.includes(record.slug)
                return (
                    <span
                        style={
                            record.topicPageCount > 1 || isMismatch
                                ? { color: "#cf1322" }
                                : undefined
                        }
                    >
                        {slugs.map((s, i) => (
                            <span key={s}>
                                {i > 0 && ", "}
                                <Typography.Text code>{s}</Typography.Text>
                            </span>
                        ))}
                    </span>
                )
            },
        },
        {
            title: "In tag graph",
            dataIndex: "inTagGraph",
            key: "inTagGraph",
            width: 110,
            align: "center",
            sorter: (a, b) => a.inTagGraph - b.inTagGraph,
            render: (val: number) =>
                val ? "✓" : <span style={{ color: "#ccc" }}>&mdash;</span>,
        },
        {
            title: "Gdocs",
            key: "gdocs",
            sorter: (a, b) =>
                a.publishedGdocCount +
                a.unpublishedGdocCount -
                (b.publishedGdocCount + b.unpublishedGdocCount),
            render: (_, record) =>
                renderCountWithSecondary(
                    record.publishedGdocCount,
                    record.unpublishedGdocCount,
                    "unpub"
                ),
        },
        {
            title: "Charts",
            key: "charts",
            sorter: (a, b) =>
                a.publishedChartCount +
                a.unpublishedChartCount -
                (b.publishedChartCount + b.unpublishedChartCount),
            render: (_, record) =>
                renderCountWithSecondary(
                    record.publishedChartCount,
                    record.unpublishedChartCount,
                    "unpub"
                ),
        },
        {
            title: "Datasets",
            key: "datasets",
            sorter: (a, b) =>
                a.activeDatasetCount +
                a.archivedDatasetCount -
                (b.activeDatasetCount + b.archivedDatasetCount),
            render: (_, record) =>
                renderCountWithSecondary(
                    record.activeDatasetCount,
                    record.archivedDatasetCount,
                    "archived"
                ),
        },
        {
            title: "Explorers",
            key: "explorers",
            sorter: (a, b) =>
                a.publishedExplorerCount +
                a.unpublishedExplorerCount -
                (b.publishedExplorerCount + b.unpublishedExplorerCount),
            render: (_, record) =>
                renderCountWithSecondary(
                    record.publishedExplorerCount,
                    record.unpublishedExplorerCount,
                    "unpub"
                ),
        },
    ]
}

export function TagMaintenancePage() {
    const { admin } = useContext(AdminAppContext)

    useEffect(() => {
        admin.loadingIndicatorSetting = "off"
        return () => {
            admin.loadingIndicatorSetting = "default"
        }
    }, [admin])

    const { data: tags } = useQuery({
        queryKey: ["tagUsageSummary"],
        queryFn: () => fetchTagUsageSummary(admin),
    })

    const [search, setSearch] = useState("")
    const [activePreset, setActivePreset] = useState<PresetKey>("all")

    const activePresetConfig = PRESETS.find((p) => p.key === activePreset)!

    const filteredTags = useMemo(() => {
        const query = search.trim().toLowerCase()
        return tags
            ?.filter(activePresetConfig.filter)
            .filter(
                (tag) =>
                    !query ||
                    tag.name.toLowerCase().includes(query) ||
                    tag.slug?.toLowerCase().includes(query)
            )
    }, [tags, search, activePresetConfig])

    const columns = useMemo(() => createColumns(), [])

    return (
        <AdminLayout title="Tag Maintenance">
            <main>
                <Flex gap={8} wrap="wrap" style={{ marginBottom: 16 }}>
                    {PRESETS.map((preset) => (
                        <Tag.CheckableTag
                            key={preset.key}
                            checked={activePreset === preset.key}
                            onChange={() => setActivePreset(preset.key)}
                            style={{
                                padding: "4px 12px",
                                fontSize: 13,
                                border: "1px solid #d9d9d9",
                            }}
                        >
                            {preset.label}
                        </Tag.CheckableTag>
                    ))}
                </Flex>
                {activePreset !== "all" && (
                    <Typography.Text
                        type="secondary"
                        style={{ display: "block", marginBottom: 12 }}
                    >
                        {activePresetConfig.description}
                    </Typography.Text>
                )}
                <Flex
                    align="center"
                    justify="space-between"
                    gap={24}
                    style={{ marginBottom: 16 }}
                >
                    <Input
                        placeholder="Search by tag name or slug"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        style={{ width: 400 }}
                        autoFocus
                    />
                    <Typography.Text>
                        Showing {filteredTags?.length ?? 0} of{" "}
                        {tags?.length ?? 0} leaf tags
                    </Typography.Text>
                </Flex>
                <Table
                    columns={columns}
                    dataSource={filteredTags}
                    rowKey="id"
                    loading={!tags}
                    pagination={{
                        defaultPageSize: 50,
                        showSizeChanger: true,
                        pageSizeOptions: ["20", "50", "100", "200"],
                    }}
                />
            </main>
        </AdminLayout>
    )
}
