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
    DbPlainMim,
    groupBy,
    Json,
    MimByParentTagNameDictionary,
    MimIncomeGroup,
    Url,
} from "@ourworldindata/utils"
import {
    faAngleDown,
    faArrowDown,
    faArrowUp,
} from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"

function MimList({
    incomeGroup,
    mims,
    deleteMim,
    rerankMims,
}: {
    parentTagName: string
    incomeGroup: MimIncomeGroup
    mims: DbPlainMim[]
    addMim: AddMimMutation
    deleteMim: DeleteMimMutation
    rerankMims: RerankMimsMutation
}) {
    const handleRerank = (mim: DbPlainMim, newRanking: number) => {
        const newMims = mims.map((m) => {
            if (m.id === mim.id) {
                return { ...m, ranking: newRanking }
            }
            if (m.ranking === newRanking) {
                return { ...m, ranking: mim.ranking }
            }
            return m
        })
        rerankMims.mutate(newMims)
    }
    return (
        <div className="mims-page-list">
            <h5 className="mims-page-list__heading">{incomeGroup}</h5>
            <ol className="mims-page-list__ol">
                {mims?.map((mim) => (
                    <li key={mim.id} className="mims-page-list__item">
                        <Flex align="center">
                            <Button
                                type="link"
                                disabled={mim.ranking === 1}
                                onClick={() =>
                                    handleRerank(mim, mim.ranking - 1)
                                }
                                icon={<FontAwesomeIcon icon={faArrowUp} />}
                            />
                            <Button
                                type="link"
                                disabled={mim.ranking === mims.length}
                                onClick={() =>
                                    handleRerank(mim, mim.ranking + 1)
                                }
                                icon={<FontAwesomeIcon icon={faArrowDown} />}
                            />

                            <a href={mim.url} target="_blank" rel="noopener">
                                {mim.url}
                            </a>
                            <Popconfirm
                                title="Are you sure to delete this MIM?"
                                onConfirm={() => {
                                    deleteMim.mutate(mim)
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

function MimSection({
    parentTagName,
    mims,
    addMim,
    deleteMim,
    rerankMims,
}: {
    parentTagName: string
    mims: DbPlainMim[]
    addMim: AddMimMutation
    deleteMim: DeleteMimMutation
    rerankMims: RerankMimsMutation
}) {
    const byIncomeGroup = useMemo(() => {
        return groupBy(mims, (mim) => mim.incomeGroup)
    }, [mims])

    const incomeGroups = Object.values(MimIncomeGroup)

    const [newMimInputValue, setNewMimInputValue] = useState("")
    const [isValid, setIsValid] = useState(false)

    useEffect(() => {
        const url = Url.fromURL(newMimInputValue)
        const isValid =
            (url.isExplorer || url.isGrapher) &&
            url.queryParams.country === undefined
        setIsValid(!!isValid)
    }, [newMimInputValue])

    const [newMimIncomeGroup, setNewMimIncomeGroup] = useState(
        MimIncomeGroup.All
    )

    return (
        <div className="mims-page-section">
            <h4 className="mims-page-section__heading">{parentTagName}</h4>

            {incomeGroups.map((incomeGroup) => {
                const mimsByIncomeGroup = byIncomeGroup[incomeGroup] ?? []
                if (mimsByIncomeGroup.length === 0) {
                    return null
                }
                return (
                    <MimList
                        key={incomeGroup}
                        parentTagName={parentTagName}
                        incomeGroup={incomeGroup}
                        mims={mimsByIncomeGroup}
                        addMim={addMim}
                        deleteMim={deleteMim}
                        rerankMims={rerankMims}
                    />
                )
            })}
            <Flex className="mims-page-section__add-mim" wrap="wrap">
                <Input
                    status={!newMimInputValue || isValid ? "" : "error"}
                    placeholder="https://ourworldindata.org/grapher/life-expectancy"
                    value={newMimInputValue}
                    onPressEnter={() => {
                        if (!newMimInputValue) {
                            notification.error({
                                message: "Please enter a URL",
                            })
                            return
                        }
                        const ranking = byIncomeGroup[newMimIncomeGroup]
                            ? byIncomeGroup[newMimIncomeGroup].length + 1
                            : 1
                        addMim.mutate({
                            url: newMimInputValue,
                            incomeGroup: newMimIncomeGroup,
                            ranking,
                            parentTagName,
                        })
                        setNewMimInputValue("")
                    }}
                    onChange={(e) => setNewMimInputValue(e.target.value)}
                />
                <Dropdown
                    menu={{
                        items: incomeGroups.map((incomeGroup) => ({
                            key: incomeGroup,
                            label: incomeGroup,
                            onClick: () => {
                                setNewMimIncomeGroup(incomeGroup)
                            },
                        })),
                    }}
                >
                    <Button>
                        {newMimIncomeGroup}
                        <FontAwesomeIcon icon={faAngleDown} />
                    </Button>
                </Dropdown>

                <Button
                    disabled={!isValid}
                    onClick={() => {
                        const ranking = byIncomeGroup[newMimIncomeGroup]
                            ? byIncomeGroup[newMimIncomeGroup].length + 1
                            : 1
                        addMim.mutate({
                            url: newMimInputValue,
                            incomeGroup: newMimIncomeGroup,
                            ranking,
                            parentTagName,
                        })
                        setNewMimInputValue("")
                    }}
                >
                    Add MIM
                </Button>
                {newMimInputValue && !isValid && (
                    <p className="mims-page-section__error-notice">
                        URL must be an OWID grapher/explorer URL and not have a{" "}
                        <span>country</span> query parameter.
                    </p>
                )}
            </Flex>
        </div>
    )
}

function MimsExplainer() {
    return (
        <Collapse
            size="small"
            className="mims-page__explanation"
            items={[
                {
                    key: "mims",
                    label: "What are MIMs?",
                    children: (
                        <>
                            <p>
                                Most important metrics (MIMs) are charts that we
                                think are most important for the public to see
                                when getting an overview of a topic or area.
                                They are specified here as grapher, explorer, or
                                MDIM URLs.
                            </p>
                            <p>
                                Currently, the only impact of designating a MIM
                                is that it will show up in the first results of
                                the data catalog and search (in the order that
                                they are ranked here.)
                            </p>
                            <p>
                                A MIM can be designated for a particular income
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
            ]}
        >
            What are MIMs?
        </Collapse>
    )
}

async function fetchMims(admin: Admin) {
    const { mims } = await admin.getJSON<{
        mims: MimByParentTagNameDictionary
    }>("/api/mims.json")
    return mims
}

type AddMimMutation = UseMutationResult<
    Json,
    unknown,
    {
        url: string
        incomeGroup: MimIncomeGroup
        ranking: number
        parentTagName: string
    },
    unknown
>

type DeleteMimMutation = UseMutationResult<
    Json,
    unknown,
    { id: number },
    unknown
>

type RerankMimsMutation = UseMutationResult<
    Json,
    unknown,
    {
        id: number
        ranking: number
    }[],
    unknown
>

export function MimsPage() {
    const { admin } = useContext(AdminAppContext)
    const [search, setSearch] = useState("")
    const queryClient = useQueryClient()

    useEffect(() => {
        admin.loadingIndicatorSetting = "off"
        return () => {
            admin.loadingIndicatorSetting = "default"
        }
    }, [admin])

    const mims = useQuery({
        queryKey: ["mims"],
        queryFn: () => fetchMims(admin),
    })
    const addMim = useMutation({
        mutationFn: (mim) => admin.requestJSON("/api/mims/new", mim, "POST"),
        onSuccess: () => queryClient.invalidateQueries(["mims"]),
    }) as AddMimMutation

    const deleteMim = useMutation({
        mutationFn: ({ id }) =>
            admin.requestJSON(`/api/mims/${id}`, {}, "DELETE"),
        onSuccess: () => queryClient.invalidateQueries(["mims"]),
    }) as DeleteMimMutation

    const rerankMims = useMutation({
        mutationFn: (mims) =>
            admin.requestJSON(`/api/mims/rerank`, mims, "POST"),
        onSuccess: () => queryClient.invalidateQueries(["mims"]),
    }) as RerankMimsMutation

    const filteredMims = useMemo(() => {
        const query = search.trim().toLowerCase()
        const entries = Object.entries(mims.data ?? {})
        const filtered = entries.filter(([key]) =>
            key.toLowerCase().includes(query)
        )
        return Object.fromEntries(filtered)
    }, [mims, search])

    return (
        <AdminLayout title="Mims">
            <main className="mims-page">
                <Flex className="mims-page__header" justify="space-between">
                    <Input
                        placeholder="Mortality, Pollution, Migration, etc..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                    <MimsExplainer />
                </Flex>
                {filteredMims &&
                    Object.keys(filteredMims).map((parentTagName) => {
                        return (
                            <MimSection
                                addMim={addMim}
                                deleteMim={deleteMim}
                                rerankMims={rerankMims}
                                key={parentTagName}
                                parentTagName={parentTagName}
                                mims={filteredMims[parentTagName]}
                            />
                        )
                    })}
            </main>
        </AdminLayout>
    )
}
