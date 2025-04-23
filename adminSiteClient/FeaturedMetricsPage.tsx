import {
    useMutation,
    UseMutationResult,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query"
import { useContext, useEffect, useMemo, useState } from "react"
import {
    Input,
    Popconfirm,
    notification,
    Dropdown,
    Button,
    Flex,
    Collapse,
} from "antd"
import { Admin } from "./Admin.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    DbPlainFeaturedMetric,
    groupBy,
    Json,
    FeaturedMetricByParentTagNameDictionary,
    FeaturedMetricIncomeGroup,
    Url,
    GRAPHER_QUERY_PARAM_KEYS,
} from "@ourworldindata/utils"
import {
    faAngleDown,
    faArrowDown,
    faArrowUp,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

function FeaturedMetricList({
    incomeGroup,
    featuredMetrics,
    deleteFeaturedMetric,
    rerankFeaturedMetrics,
}: {
    parentTagName: string
    incomeGroup: FeaturedMetricIncomeGroup
    featuredMetrics: DbPlainFeaturedMetric[]
    addFeaturedMetric: AddFeaturedMetricMutation
    deleteFeaturedMetric: DeleteFeaturedMetricMutation
    rerankFeaturedMetrics: RerankFeaturedMetricsMutation
}) {
    const handleRerank = (
        featuredMetric: DbPlainFeaturedMetric,
        newRanking: number
    ) => {
        const newFeaturedMetrics = featuredMetrics.map((m) => {
            if (m.id === featuredMetric.id) {
                return { ...m, ranking: newRanking }
            }
            if (m.ranking === newRanking) {
                return { ...m, ranking: featuredMetric.ranking }
            }
            return m
        })
        rerankFeaturedMetrics.mutate(newFeaturedMetrics)
    }
    return (
        <div className="featured-metrics-page-list">
            <h5 className="featured-metrics-page-list__heading">
                {incomeGroup}
            </h5>
            <ol className="featured-metrics-page-list__ol">
                {featuredMetrics?.map((featuredMetric) => (
                    <li
                        key={featuredMetric.id}
                        className="featured-metrics-page-list__item"
                    >
                        <Flex align="center">
                            <Button
                                type="link"
                                disabled={featuredMetric.ranking === 1}
                                onClick={() =>
                                    handleRerank(
                                        featuredMetric,
                                        featuredMetric.ranking - 1
                                    )
                                }
                                icon={<FontAwesomeIcon icon={faArrowUp} />}
                            />
                            <Button
                                type="link"
                                disabled={
                                    featuredMetric.ranking ===
                                    featuredMetrics.length
                                }
                                onClick={() =>
                                    handleRerank(
                                        featuredMetric,
                                        featuredMetric.ranking + 1
                                    )
                                }
                                icon={<FontAwesomeIcon icon={faArrowDown} />}
                            />

                            <a
                                href={featuredMetric.url}
                                target="_blank"
                                rel="noopener"
                            >
                                {featuredMetric.url}
                            </a>
                            <Popconfirm
                                title="Are you sure to delete this Featured Metric?"
                                onConfirm={() => {
                                    deleteFeaturedMetric.mutate(featuredMetric)
                                }}
                                okText="Yes"
                                cancelText="No"
                            >
                                <Button type="link" danger>
                                    Delete
                                </Button>
                            </Popconfirm>
                        </Flex>
                    </li>
                ))}
            </ol>
        </div>
    )
}

function filterUrlQueryParams(url: string): string {
    if (!url) return ""
    if (!url.includes("?")) return url

    function removeQueryParam(url: string, paramName: string): string {
        return url.replace(
            new RegExp(`([?&])${paramName}=[^&]*(&|$)`, "g"),
            (_, prefix, suffix) => {
                // If the suffix is & (meaning there are more params), keep the prefix
                // If the suffix is empty (end of string), keep nothing unless prefix is ? and it's the only param
                return suffix === "&" ? prefix : prefix === "?" ? "?" : ""
            }
        )
    }

    url = GRAPHER_QUERY_PARAM_KEYS.reduce(
        (currentUrl, param) => removeQueryParam(currentUrl, param),
        url
    )

    return url
}

function FeaturedMetricSection({
    parentTagName,
    featuredMetrics,
    addFeaturedMetric,
    deleteFeaturedMetric,
    rerankFeaturedMetrics,
}: {
    parentTagName: string
    featuredMetrics: DbPlainFeaturedMetric[]
    addFeaturedMetric: AddFeaturedMetricMutation
    deleteFeaturedMetric: DeleteFeaturedMetricMutation
    rerankFeaturedMetrics: RerankFeaturedMetricsMutation
}) {
    const byIncomeGroup = useMemo(() => {
        return groupBy(
            featuredMetrics,
            (featuredMetric) => featuredMetric.incomeGroup
        )
    }, [featuredMetrics])

    const incomeGroups = Object.values(FeaturedMetricIncomeGroup)

    const [newFeaturedMetricInputValue, setNewFeaturedMetricInputValue] =
        useState("")
    const handleInputChange = (inputValue: string) => {
        setNewFeaturedMetricInputValue(filterUrlQueryParams(inputValue))
    }

    const [{ isValid, reason }, setIsValid] = useState({
        isValid: false,
        reason: "",
    })

    useEffect(() => {
        const url = Url.fromURL(newFeaturedMetricInputValue)
        if (!url.isExplorer && !url.isGrapher) {
            setIsValid({
                isValid: false,
                reason: "URL must be an OWID grapher/explorer URL",
            })
        } else if (url.isExplorer && !url.queryStr) {
            setIsValid({
                isValid: false,
                reason: "Explorer URLs must have the view's query string",
            })
        } else {
            setIsValid({ isValid: true, reason: "" })
        }
    }, [newFeaturedMetricInputValue])

    const [newFeaturedMetricIncomeGroup, setNewFeaturedMetricIncomeGroup] =
        useState(FeaturedMetricIncomeGroup.Default)

    const handleAddFeaturedMetric = () => {
        const ranking = byIncomeGroup[newFeaturedMetricIncomeGroup]
            ? byIncomeGroup[newFeaturedMetricIncomeGroup].length + 1
            : 1
        addFeaturedMetric.mutate({
            url: newFeaturedMetricInputValue,
            incomeGroup: newFeaturedMetricIncomeGroup,
            ranking,
            parentTagName,
        })
        handleInputChange("")
    }

    return (
        <div className="featured-metrics-page-section">
            <h4 className="featured-metrics-page-section__heading">
                {parentTagName}
            </h4>

            {incomeGroups.map((incomeGroup) => {
                const featuredMetricsByIncomeGroup =
                    byIncomeGroup[incomeGroup] ?? []
                if (featuredMetricsByIncomeGroup.length === 0) {
                    return null
                }
                return (
                    <FeaturedMetricList
                        key={incomeGroup}
                        parentTagName={parentTagName}
                        incomeGroup={incomeGroup}
                        featuredMetrics={featuredMetricsByIncomeGroup}
                        addFeaturedMetric={addFeaturedMetric}
                        deleteFeaturedMetric={deleteFeaturedMetric}
                        rerankFeaturedMetrics={rerankFeaturedMetrics}
                    />
                )
            })}
            <Flex
                className="featured-metrics-page-section__add-featured-metric"
                wrap="wrap"
            >
                <Input
                    status={
                        !newFeaturedMetricInputValue || isValid ? "" : "error"
                    }
                    placeholder="https://ourworldindata.org/grapher/life-expectancy"
                    value={newFeaturedMetricInputValue}
                    onPressEnter={() => {
                        if (!newFeaturedMetricInputValue || !isValid) {
                            notification.error({
                                message: "Please enter a valid URL",
                            })
                            return
                        }
                        handleAddFeaturedMetric()
                    }}
                    onBlur={() => {
                        if (
                            newFeaturedMetricInputValue.endsWith("?") ||
                            newFeaturedMetricInputValue.endsWith("/")
                        ) {
                            handleInputChange(
                                newFeaturedMetricInputValue.slice(0, -1)
                            )
                        }
                    }}
                    onChange={(e) => handleInputChange(e.target.value)}
                />
                <Dropdown
                    menu={{
                        items: incomeGroups.map((incomeGroup) => ({
                            key: incomeGroup,
                            label: incomeGroup,
                            onClick: () => {
                                setNewFeaturedMetricIncomeGroup(incomeGroup)
                            },
                        })),
                    }}
                >
                    <Button>
                        {newFeaturedMetricIncomeGroup}
                        <FontAwesomeIcon icon={faAngleDown} />
                    </Button>
                </Dropdown>

                <Button
                    disabled={!isValid}
                    onClick={() => handleAddFeaturedMetric()}
                >
                    Add
                </Button>
                {newFeaturedMetricInputValue && !isValid && (
                    <p className="featured-metrics-page-section__error-notice">
                        {reason}
                    </p>
                )}
            </Flex>
        </div>
    )
}

function FeaturedMetricsExplainer() {
    return (
        <Collapse
            size="small"
            className="featured-metrics-page__explanation"
            items={[
                {
                    key: "featuredMetrics",
                    label: "What are Featured Metrics?",
                    children: (
                        <>
                            <p>
                                Featured metrics (FMs) are charts that we think
                                are most important for the public to see when
                                getting an overview of a topic or area. They are
                                specified here as grapher, explorer, or MDIM
                                URLs.
                            </p>
                            <p>
                                Currently, the only impact of designating an FM
                                is that it will show up in the first results of
                                the data catalog and search (in the order that
                                they are ranked here.)
                            </p>
                            <p>
                                An FM can be designated for a particular income
                                group (as specified by the{" "}
                                <a
                                    href="https://ourworldindata.org/grapher/world-bank-income-groups"
                                    target="_blank"
                                    rel="noopener"
                                >
                                    World Bank
                                </a>
                                ) which means that it will only show up at the
                                top of the data catalog if a country belonging
                                to that income group has been selected as a
                                filter. This is so we can highlight "Share
                                living above the poverty line" charts when a
                                low-income country is selected, but not when a
                                high-income country is selected.
                            </p>
                        </>
                    ),
                },
                {
                    key: "explorers",
                    label: "How do I set an Explorer Featured Metric?",
                    children: (
                        <>
                            <p>
                                Explorer Featured Metrics require the whole
                                explorer's query string, minus any query
                                parameters that customize the grapher chart
                                (country, tab, etc...)
                            </p>
                            <p>e.g.</p>
                            <p>
                                <span>
                                    https://ourworldindata.org/explorers/monkeypox?Metric=Confirmed+cases&Frequency=7-day+average&Relative+to+population=false
                                </span>
                            </p>
                            <p>
                                If the default view of the explorer is the one
                                you want, you can get its full query string
                                representation by clicking another view, and
                                then navigating back to the default.
                            </p>
                        </>
                    ),
                },
            ]}
        />
    )
}

async function fetchFeaturedMetrics(admin: Admin) {
    const { featuredMetrics } = await admin.getJSON<{
        featuredMetrics: FeaturedMetricByParentTagNameDictionary
    }>("/api/featured-metrics.json")
    return featuredMetrics
}

type AddFeaturedMetricMutation = UseMutationResult<
    Json,
    unknown,
    {
        url: string
        incomeGroup: FeaturedMetricIncomeGroup
        ranking: number
        parentTagName: string
    },
    unknown
>

type DeleteFeaturedMetricMutation = UseMutationResult<
    Json,
    unknown,
    { id: number },
    unknown
>

type RerankFeaturedMetricsMutation = UseMutationResult<
    Json,
    unknown,
    {
        id: number
        ranking: number
    }[],
    unknown
>

export function FeaturedMetricsPage() {
    const { admin } = useContext(AdminAppContext)
    const [search, setSearch] = useState("")
    const queryClient = useQueryClient()

    useEffect(() => {
        admin.loadingIndicatorSetting = "off"
        return () => {
            admin.loadingIndicatorSetting = "default"
        }
    }, [admin])

    const featuredMetrics = useQuery({
        queryKey: ["featuredMetrics"],
        queryFn: () => fetchFeaturedMetrics(admin),
    })
    const addFeaturedMetric = useMutation({
        mutationFn: (featuredMetric) =>
            admin.requestJSON(
                "/api/featured-metrics/new",
                featuredMetric,
                "POST"
            ),
        onSuccess: () => queryClient.invalidateQueries(["featuredMetrics"]),
    }) as AddFeaturedMetricMutation

    const deleteFeaturedMetric = useMutation({
        mutationFn: ({ id }) =>
            admin.requestJSON(`/api/featured-metrics/${id}`, {}, "DELETE"),
        onSuccess: () => queryClient.invalidateQueries(["featuredMetrics"]),
    }) as DeleteFeaturedMetricMutation

    const rerankFeaturedMetrics = useMutation({
        mutationFn: (featuredMetrics) =>
            admin.requestJSON(
                `/api/featured-metrics/rerank`,
                featuredMetrics,
                "POST"
            ),
        onSuccess: () => queryClient.invalidateQueries(["featuredMetrics"]),
    }) as RerankFeaturedMetricsMutation

    const filteredFeaturedMetrics = useMemo(() => {
        const query = search.trim().toLowerCase()
        const entries = Object.entries(featuredMetrics.data ?? {})
        const filtered = entries.filter(([key]) =>
            key.toLowerCase().includes(query)
        )
        return Object.fromEntries(filtered)
    }, [featuredMetrics, search])

    return (
        <AdminLayout title="Featured Metrics">
            <main className="featured-metrics-page">
                <Flex
                    className="featured-metrics-page__header"
                    justify="space-between"
                >
                    <Input
                        placeholder="Mortality, Pollution, Migration, etc..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                    <FeaturedMetricsExplainer />
                </Flex>
                {filteredFeaturedMetrics &&
                    Object.keys(filteredFeaturedMetrics).map(
                        (parentTagName) => {
                            return (
                                <FeaturedMetricSection
                                    addFeaturedMetric={addFeaturedMetric}
                                    deleteFeaturedMetric={deleteFeaturedMetric}
                                    rerankFeaturedMetrics={
                                        rerankFeaturedMetrics
                                    }
                                    key={parentTagName}
                                    parentTagName={parentTagName}
                                    featuredMetrics={
                                        filteredFeaturedMetrics[parentTagName]
                                    }
                                />
                            )
                        }
                    )}
            </main>
        </AdminLayout>
    )
}
