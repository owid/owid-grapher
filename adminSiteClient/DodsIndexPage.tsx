import {
    useMutation,
    UseMutationResult,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query"
import { useContext, useMemo, useState } from "react"
import { Flex, Input, Table } from "antd"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext } from "./AdminAppContext.js"
import { DbPlainDod, DbPlainUser } from "@ourworldindata/types"
import { ColumnsType } from "antd/es/table/InternalTable.js"
import { EditableTextarea } from "./EditableTextarea.js"
import { indexBy } from "remeda"
import { Admin } from "./Admin.js"

function DodEditor({
    text,
    id,
    dodMutation,
}: {
    text: string
    id: number
    dodMutation: DodMutationType
}) {
    const [value, setValue] = useState(text)

    return (
        <div className="DodEditor">
            <EditableTextarea
                autoResize
                onChange={setValue}
                value={value}
                onSave={(value) => {
                    dodMutation.mutate({
                        id,
                        content: value,
                    })
                }}
            />
        </div>
    )
}

function createColumns({
    dodMutation,
    users,
}: {
    dodMutation: DodMutationType
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
            sorter: true,
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
                    <div className="dod-content">
                        <DodEditor
                            text={content}
                            id={dod.id}
                            dodMutation={dodMutation}
                        />
                    </div>
                )
            },
        },
    ]
}

async function fetchDods(admin: Admin) {
    const { dods } = await admin.getJSON<{
        dods: DbPlainDod[]
    }>("/api/dods.json")
    return indexBy(dods, (d) => d.id)
}

async function fetchUsers(admin: Admin) {
    const { users } = await admin.getJSON<{
        users: DbPlainUser[]
    }>("/api/users.json")
    return indexBy(users, (u) => u.id)
}

type DodMutationType = UseMutationResult<
    DbPlainDod,
    unknown,
    { id: number; content: string },
    unknown
>

async function patchDod(admin: Admin, id: number, data: { content: string }) {
    const response = await admin.requestJSON<DbPlainDod>(
        `/api/dods/${id}`,
        data,
        "PATCH"
    )
    return response
}

export function DodsIndexPage() {
    const { admin } = useContext(AdminAppContext)
    const [dodSearchValue, setDodSearchValue] = useState("")
    const queryClient = useQueryClient()

    const { data: dods } = useQuery({
        queryKey: ["dods"],
        queryFn: () => fetchDods(admin),
    })

    const { data: users } = useQuery({
        queryKey: ["users"],
        queryFn: () => fetchUsers(admin),
    })

    const dodMutation = useMutation({
        mutationFn: ({ id, content }: { id: number; content: string }) =>
            patchDod(admin, id, { content }),
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
        () => createColumns({ users, dodMutation }),
        [users, dodMutation]
    )

    return (
        <AdminLayout title="Dods">
            <main className="DodsIndexPage">
                <Flex justify="space-between">
                    <Input
                        placeholder="Search by content, id, or most recent user"
                        value={dodSearchValue}
                        onChange={(e) => setDodSearchValue(e.target.value)}
                        style={{ width: 500, marginBottom: 20 }}
                    />
                </Flex>
                <Table
                    className="dods-table"
                    size="small"
                    columns={columns}
                    dataSource={filteredDods}
                    rowKey={(x) => x.id}
                />
            </main>
        </AdminLayout>
    )
}
