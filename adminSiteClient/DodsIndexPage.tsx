import {
    useMutation,
    UseMutationResult,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query"
import { useContext, useEffect, useMemo, useState } from "react"
import cx from "classnames"
import { tippy } from "@tippyjs/react"
import { Button, Flex, Form, Input, Modal, Popconfirm, Table } from "antd"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import {
    DbPlainDod,
    DbPlainUser,
    DodUsageRecord,
    DodUsageTypes,
} from "@ourworldindata/types"
import { ColumnsType } from "antd/es/table/InternalTable.js"
import { EditableTextarea } from "./EditableTextarea.js"
import { indexBy } from "remeda"
import { Admin } from "./Admin.js"
import { fromMarkdown } from "mdast-util-from-markdown"
import { Content, PhrasingContent } from "mdast"
import { renderToStaticMarkup } from "react-dom/server"
import { MarkdownTextWrap } from "@ourworldindata/components"
import TextArea from "antd/es/input/TextArea.js"
import { match } from "ts-pattern"
import { BAKED_BASE_URL } from "../settings/clientSettings.js"
import { extractDetailsFromSyntax } from "@ourworldindata/utils"

type ValidPhrasingContent = Extract<
    PhrasingContent,
    { type: "text" | "link" | "emphasis" | "strong" | "break" }
>

function validateParagraphChildren(
    children: Content[],
    dods: Record<string, DbPlainDod> | undefined
): children is ValidPhrasingContent[] {
    return children.every((child) => {
        if (child.type === "text") {
            return true
        }
        if (child.type === "link") {
            const referencedDods = extractDetailsFromSyntax(child.url)
            const areAllReferencedDodsValid = referencedDods.every(
                (dod) => dods && dods[dod]
            )
            return (
                child &&
                areAllReferencedDodsValid &&
                validateParagraphChildren(child.children, dods)
            )
        }
        if (child.type === "emphasis" || child.type === "strong") {
            return validateParagraphChildren(child.children, dods)
        }
        if (child.type === "break") {
            return true
        }

        return false
    })
}

function validateDodContent(
    content: string | undefined | null,
    dods: Record<string, DbPlainDod> | undefined
): boolean {
    if (!content) {
        return true
    }
    const ast = fromMarkdown(content)
    const isValid = ast.children.every((node) => {
        if (node.type === "paragraph") {
            const paragraphChildren = node.children
            return validateParagraphChildren(paragraphChildren, dods)
        }
        if (node.type === "list") {
            return node.children.every((listItem) => {
                if (listItem.type === "listItem") {
                    return listItem.children.every((child) => {
                        if (child.type !== "paragraph") {
                            return false
                        }
                        const paragraphChildren = child.children
                        return validateParagraphChildren(
                            paragraphChildren,
                            dods
                        )
                    })
                }
                return false
            })
        }

        return false
    })
    return isValid
}

function InvalidDodMessage() {
    return (
        <div className="DodEditor__error">
            <strong>Invalid markdown</strong>
            Only basic text, **emphasis**, *strong*,
            [links](https://example.org), and lists are supported. Ensure you
            don't have typos in any [nested dods](#dod:nested).
        </div>
    )
}

function DodEditor({
    dods,
    id,
    patchDodMutation,
    text,
}: {
    dods: Record<string, DbPlainDod> | undefined
    id: number
    patchDodMutation: PatchDodMutationType
    text: string
}) {
    const [value, setValue] = useState(text)
    const isValid = validateDodContent(value, dods)

    return (
        <div className={cx("DodEditor", { "DodEditor--has-error": !isValid })}>
            <EditableTextarea
                autoResize
                onChange={setValue}
                value={value}
                valid={isValid}
                onSave={(value) => {
                    patchDodMutation.mutate({
                        id,
                        content: value,
                    })
                }}
                extraActions={isValid ? null : <InvalidDodMessage />}
            />
        </div>
    )
}

function createColumns({
    deleteDodMutation,
    dods,
    dodUsage,
    patchDodMutation,
    setActiveDodForUsageModal,
    users,
}: {
    deleteDodMutation: DeleteDodMutationType
    dods: Record<string, DbPlainDod> | undefined
    dodUsage: Record<string, DodUsageRecord[]> | undefined
    patchDodMutation: PatchDodMutationType
    setActiveDodForUsageModal: (name: string) => void
    users: Record<string, DbPlainUser> | undefined
}): ColumnsType<DbPlainDod> {
    return [
        {
            title: "Name",
            dataIndex: "name",
            key: "name",
            width: 50,
        },
        {
            title: "Last updated by",
            dataIndex: "lastUpdatedUserId",
            key: "lastUpdatedUserId",
            width: 150,
            render: (userId: number) => {
                const user = users?.[userId]
                return user ? user.fullName : "Unknown"
            },
        },
        {
            title: "Last updated",
            dataIndex: "updatedAt",
            key: "updatedAt",
            width: 200,
            defaultSortOrder: "descend",
            sorter: (a, b) =>
                new Date(a.updatedAt).getTime() -
                new Date(b.updatedAt).getTime(),
            render: (updatedAt: string) => {
                const date = new Date(updatedAt)
                return `${date.toLocaleTimeString()} ${date.toLocaleDateString()}`
            },
        },
        {
            title: "Content",
            dataIndex: "content",
            key: "content",
            render: (content: string, dod: DbPlainDod) => {
                return (
                    <div className="dod-content" data-dod-id={dod.id}>
                        <DodEditor
                            text={content}
                            id={dod.id}
                            patchDodMutation={patchDodMutation}
                            dods={dods}
                        />
                    </div>
                )
            },
        },
        {
            title: "Actions",
            dataIndex: "content",
            width: 220,
            sorter: (a, b) => {
                if (!dodUsage) return 0
                const aUsage = dodUsage?.[a.name]?.length || 0
                const bUsage = dodUsage?.[b.name]?.length || 0
                return aUsage - bUsage
            },
            key: "actions",
            render: (_, dod) => {
                if (!dodUsage) {
                    return (
                        <div className="DodEditor__actions-spinner">
                            <Button disabled loading />
                            <Button disabled loading />
                            <Button disabled loading />
                        </div>
                    )
                }
                const usage = dodUsage?.[dod.name] || []

                return (
                    <div className="DodEditor__actions">
                        <Button
                            variant="filled"
                            color="blue"
                            onMouseEnter={(event) => {
                                const textarea = document.querySelector(
                                    `.dod-content[data-dod-id="${dod.id}"] textarea`
                                )
                                if (!textarea) return

                                const text = textarea.textContent
                                const target = event.currentTarget as any

                                if (text && !target._tippy) {
                                    showDodPreviewTooltip(text, target)
                                }
                            }}
                        >
                            Preview
                        </Button>
                        <Button
                            onClick={() => setActiveDodForUsageModal(dod.name)}
                        >
                            Usage
                            <span>{usage.length || 0}</span>
                        </Button>
                        <Popconfirm
                            title="Are you sure?"
                            description="This action cannot be undone."
                            onConfirm={() =>
                                deleteDodMutation.mutate({
                                    id: dod.id,
                                })
                            }
                            okText="Yes"
                            cancelText="No"
                        >
                            <Button
                                color="danger"
                                variant="filled"
                                disabled={!!usage.length}
                            >
                                {usage.length
                                    ? "Cannot delete while in use"
                                    : "Delete"}
                            </Button>
                        </Popconfirm>
                    </div>
                )
            },
        },
    ]
}

function showDodPreviewTooltip(text: string, element: Element): void {
    const content = renderToStaticMarkup(
        <div className="dod-container">
            <MarkdownTextWrap text={text} fontSize={16} lineHeight={1.55} />
        </div>
    )
    tippy(element, {
        content,
        allowHTML: true,
        delay: [null, 200],
        interactive: true,
        hideOnClick: false,
        arrow: false,
        theme: "light dod",
        appendTo: document.body,
        onHidden: (instance) => instance.destroy(),
    })
}

async function fetchDods(admin: Admin) {
    const { dods } = await admin.getJSON<{
        dods: DbPlainDod[]
    }>("/api/dods.json")
    return indexBy(dods, (d) => d.name)
}

async function fetchDodUsage(admin: Admin) {
    const usageDictionary = await admin.getJSON<
        Record<string, DodUsageRecord[]>
    >("/api/dods-usage.json")

    return usageDictionary
}

async function fetchUsers(admin: Admin) {
    const { users } = await admin.getJSON<{
        users: DbPlainUser[]
    }>("/api/users.json")
    return indexBy(users, (u) => u.id)
}

type DodMutation<T> = UseMutationResult<DbPlainDod, unknown, T, unknown>

type PatchDodMutationType = DodMutation<{ id: number; content: string }>

type DeleteDodMutationType = DodMutation<{ id: number }>

type CreateDodMutationType = DodMutation<{ content: string; name: string }>

async function patchDod(admin: Admin, id: number, data: { content: string }) {
    const response = await admin.requestJSON<DbPlainDod>(
        `/api/dods/${id}`,
        data,
        "PATCH"
    )
    return response
}

async function deleteDod(admin: Admin, id: number) {
    const response = await admin.requestJSON<DbPlainDod>(
        `/api/dods/${id}`,
        {},
        "DELETE"
    )
    return response
}

async function createDod(
    admin: Admin,
    data: { content: string; name: string }
) {
    const response = await admin.requestJSON<DbPlainDod>(
        `/api/dods`,
        data,
        "POST"
    )
    return response
}

function CreateDodModal({
    createDodMutation,
    isOpen,
    onClose,
    dods,
}: {
    createDodMutation: CreateDodMutationType
    isOpen: boolean
    onClose: () => void
    dods: Record<string, DbPlainDod> | undefined
}) {
    const [form] = Form.useForm()
    const [isFilled, setIsFilled] = useState(false)
    const [isContentValid, setIsContentValid] = useState(true)

    const values = Form.useWatch([], form)

    useEffect(() => {
        form.validateFields()
            .then(() => setIsFilled(true))
            .catch(() => setIsFilled(false))
    }, [form, values])

    useEffect(() => {
        setIsContentValid(validateDodContent(values?.content, dods))
    }, [dods, values])

    return (
        <Modal
            title="Create Detail on Demand"
            open={isOpen}
            onCancel={onClose}
            footer={null}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={(values) => {
                    createDodMutation.mutate(values)
                    form.resetFields()
                    onClose()
                }}
            >
                <Form.Item
                    label="Name"
                    name="name"
                    rules={[
                        { required: true },
                        { pattern: /^[^\s]+$/, message: "No spaces allowed" },
                        {
                            validator: (_, value) => {
                                if (dods && dods[value]) {
                                    return Promise.reject(
                                        new Error("Dod already exists")
                                    )
                                }
                                return Promise.resolve()
                            },
                        },
                    ]}
                >
                    <Input autoComplete="off" />
                </Form.Item>
                <Form.Item
                    label="Content"
                    name="content"
                    rules={[{ required: true }]}
                >
                    <TextArea rows={8} />
                </Form.Item>
                <Form.Item>
                    <Button
                        type="primary"
                        htmlType="submit"
                        disabled={!isFilled || !isContentValid}
                    >
                        Submit
                    </Button>
                </Form.Item>
            </Form>
            {!isContentValid && <InvalidDodMessage />}
        </Modal>
    )
}

function DodUsageModal({
    dodUsage,
    activeDodForUsageModal,
    setActiveDodForUsageModal,
}: {
    dodUsage: Record<string, DodUsageRecord[]> | undefined
    activeDodForUsageModal: string | null
    setActiveDodForUsageModal: (name: string | null) => void
}) {
    if (!dodUsage || !activeDodForUsageModal) return null
    const activeDodUsage = dodUsage[activeDodForUsageModal]
    if (!activeDodUsage) return null

    const presentUsageTypes = new Set(
        activeDodUsage.map((dodUsageRecord) => dodUsageRecord.type)
    )

    const filtersToDisplay = DodUsageTypes.filter((dodUsageType) =>
        presentUsageTypes.has(dodUsageType)
    ).map((dodUsageType) => ({
        text: dodUsageType,
        value: dodUsageType,
    }))

    return (
        <Modal
            width="80vw"
            title={`Usage of ${activeDodForUsageModal}`}
            open={!!activeDodForUsageModal}
            onCancel={() => setActiveDodForUsageModal(null)}
            footer={null}
        >
            <Table
                dataSource={activeDodUsage}
                columns={[
                    {
                        title: "Resource",
                        dataIndex: "title",
                        key: "title",
                        render: (_, dodUsageRecord: DodUsageRecord) => {
                            function makeUrlForUsageRecord(
                                dodUsageRecord: DodUsageRecord
                            ): string | undefined {
                                return match(dodUsageRecord.type)
                                    .with("explorer", () => {
                                        return `/admin/explorers/${dodUsageRecord.id}`
                                    })
                                    .with("gdoc", () => {
                                        return `/admin/gdocs/${dodUsageRecord.id}/preview`
                                    })
                                    .with("grapher", () => {
                                        return `${BAKED_BASE_URL}/grapher/${dodUsageRecord.id}`
                                    })
                                    .with("indicator", () => {
                                        return `/admin/variables/${dodUsageRecord.id}`
                                    })
                                    .with("dod", () => {
                                        return undefined
                                    })
                                    .exhaustive()
                            }
                            const url = makeUrlForUsageRecord(dodUsageRecord)
                            if (!url) {
                                return <span>{dodUsageRecord.title}</span>
                            }
                            return (
                                <a
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {dodUsageRecord.title}
                                </a>
                            )
                        },
                    },
                    {
                        title: "Type",
                        dataIndex: "type",
                        key: "type",
                        width: 200,
                        filterOnClose: true,
                        filters: filtersToDisplay,
                        onFilter: (value, record) => {
                            return record.type === value
                        },
                    },
                ]}
            />
        </Modal>
    )
}

export function DodsIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [dodSearchValue, setDodSearchValue] = useState("")
    const [isCreateDodModalOpen, setIsCreateDodModalOpen] = useState(false)
    const [activeDodForUsageModal, setActiveDodForUsageModal] = useState<
        string | null
    >(null)
    const queryClient = useQueryClient()

    const { data: dods } = useQuery({
        queryKey: ["dods"],
        queryFn: () => fetchDods(admin),
    })

    const { data: dodUsage } = useQuery({
        queryKey: ["dod-usage"],
        queryFn: () => fetchDodUsage(admin),
    })

    const { data: users } = useQuery({
        queryKey: ["users"],
        queryFn: () => fetchUsers(admin),
    })

    const patchDodMutation = useMutation({
        mutationFn: ({ id, content }: { id: number; content: string }) =>
            patchDod(admin, id, { content }),
        onSuccess: async () => {
            return queryClient.invalidateQueries({ queryKey: ["dods"] })
        },
    })

    const deleteDodMutation = useMutation({
        mutationFn: ({ id }: { id: number }) => deleteDod(admin, id),
        onSuccess: async () => {
            return queryClient.invalidateQueries({ queryKey: ["dods"] })
        },
    })

    const createDodMutation = useMutation({
        mutationFn: ({ content, name }: { content: string; name: string }) =>
            createDod(admin, { content, name }),
        onSuccess: async () => {
            return queryClient.invalidateQueries({ queryKey: ["dods"] })
        },
    })

    const filteredDods = useMemo(
        () =>
            dods
                ? Object.values(dods).filter(
                      (dod) =>
                          users?.[dod.lastUpdatedUserId]?.fullName
                              .toLowerCase()
                              .includes(dodSearchValue.toLowerCase()) ||
                          dod.name
                              .toLowerCase()
                              .includes(dodSearchValue.toLowerCase()) ||
                          dod.content
                              .toLowerCase()
                              .includes(dodSearchValue.toLowerCase())
                  )
                : [],
        [dods, dodSearchValue, users]
    )

    const columns = useMemo(
        () =>
            createColumns({
                deleteDodMutation,
                dods,
                dodUsage,
                patchDodMutation,
                setActiveDodForUsageModal,
                users,
            }),
        [
            deleteDodMutation,
            dods,
            dodUsage,
            patchDodMutation,
            setActiveDodForUsageModal,
            users,
        ]
    )

    return (
        <AdminLayout title="DoDs">
            <main className="DodsIndexPage">
                <Flex justify="space-between">
                    <Input
                        placeholder="Search by content, id, or most recent user"
                        value={dodSearchValue}
                        onChange={(e) => setDodSearchValue(e.target.value)}
                        style={{ width: 500, marginBottom: 20 }}
                    />
                    <Button
                        variant="solid"
                        color="blue"
                        style={{ padding: "0 35px" }}
                        onClick={() => setIsCreateDodModalOpen(true)}
                    >
                        Create
                    </Button>
                </Flex>
                <Table
                    className="DodEditor__table"
                    size="small"
                    columns={columns}
                    dataSource={filteredDods}
                    rowKey={(x) => x.id}
                />
                <CreateDodModal
                    createDodMutation={createDodMutation}
                    isOpen={isCreateDodModalOpen}
                    onClose={() => setIsCreateDodModalOpen(false)}
                    dods={dods}
                />
                <DodUsageModal
                    dodUsage={dodUsage}
                    activeDodForUsageModal={activeDodForUsageModal}
                    setActiveDodForUsageModal={setActiveDodForUsageModal}
                />
            </main>
        </AdminLayout>
    )
}
