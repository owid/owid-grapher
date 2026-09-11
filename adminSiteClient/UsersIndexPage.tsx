import * as React from "react"
import { useContext, useMemo, useState } from "react"
import { observer } from "mobx-react"
import { observable, action, runInAction, makeObservable } from "mobx"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Button, Popconfirm, TableColumnsType, Tag } from "antd"

import { Modal, Timeago } from "./Forms.js"
import { Link } from "./Link.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { AdminTable } from "./AdminTable.js"
import {
    filterBySearchWords,
    useSearchQueryParam,
} from "./adminTableHelpers.js"
import { UserIndexMeta } from "./UserMeta.js"

interface UserIndexMetaWithLastSeen extends UserIndexMeta {
    lastSeen: Date
}

const userKeys = {
    all: ["users"] as const,
    list: () => [...userKeys.all, "list"] as const,
}

@observer
class InviteModal extends React.Component<{ onClose: () => void }> {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    email: string = ""
    fullName: string = ""
    responseSuccess: boolean = false

    constructor(props: { onClose: () => void }) {
        super(props)

        makeObservable(this, {
            email: observable,
            fullName: observable,
            responseSuccess: observable,
        })
    }

    async submit() {
        runInAction(() => (this.responseSuccess = false))
        if (this.email) {
            const resp = await this.context.admin.requestJSON(
                "/api/users/add",
                { email: this.email, fullName: this.fullName },
                "POST"
            )
            if (resp.success) {
                runInAction(() => (this.responseSuccess = true))
            }
        }
    }

    @action.bound onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault()
        void this.submit()
    }

    override render() {
        return (
            <Modal onClose={this.props.onClose}>
                <form onSubmit={this.onSubmit}>
                    <div className="modal-header">
                        <h5 className="modal-title">Add a user</h5>
                    </div>
                    <div className="modal-body">
                        <div className="form-group">
                            <label>Full name</label>
                            <input
                                type="text"
                                className="form-control"
                                onChange={(e) =>
                                    (this.fullName = e.currentTarget.value)
                                }
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Email</label>
                            <input
                                type="email"
                                className="form-control"
                                onChange={(e) =>
                                    (this.email = e.currentTarget.value)
                                }
                                required
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <input
                            type="submit"
                            className="btn btn-primary"
                            value="Add user"
                        />
                    </div>
                    {this.responseSuccess && (
                        <div className="alert alert-success" role="alert">
                            User added! They can now log in with their G Suite
                            account.
                        </div>
                    )}
                </form>
            </Modal>
        )
    }
}

/** Null-safe, so that users who have never logged in still sort. */
function timestamp(date: Date | null | undefined): number {
    return date ? new Date(date).getTime() : 0
}

function createColumns({
    isSuperuser,
    onDelete,
}: {
    isSuperuser: boolean
    onDelete: (user: UserIndexMetaWithLastSeen) => void
}): TableColumnsType<UserIndexMetaWithLastSeen> {
    const columns: TableColumnsType<UserIndexMetaWithLastSeen> = [
        {
            title: "Name",
            dataIndex: "fullName",
            key: "fullName",
            sorter: (a, b) => a.fullName.localeCompare(b.fullName),
        },
        {
            title: "Last seen",
            dataIndex: "lastSeen",
            key: "lastSeen",
            width: 200,
            // Matches the order the API returns users in
            defaultSortOrder: "descend",
            sorter: (a, b) => timestamp(a.lastSeen) - timestamp(b.lastSeen),
            render: (lastSeen) => lastSeen && <Timeago time={lastSeen} />,
        },
        {
            title: "Joined",
            dataIndex: "createdAt",
            key: "createdAt",
            width: 200,
            sorter: (a, b) => timestamp(a.createdAt) - timestamp(b.createdAt),
            render: (createdAt) => <Timeago time={createdAt} />,
        },
    ]

    if (!isSuperuser) return columns

    return [
        ...columns,
        {
            title: "Status",
            dataIndex: "isActive",
            key: "isActive",
            width: 120,
            sorter: (a, b) => Number(b.isActive) - Number(a.isActive),
            render: (isActive) =>
                isActive ? (
                    <Tag color="green">active</Tag>
                ) : (
                    <Tag>disabled</Tag>
                ),
        },
        {
            title: "Actions",
            key: "actions",
            width: 180,
            render: (_, user) => (
                <>
                    <Link to={`/users/${user.id}`}>
                        <Button type="text">Edit</Button>
                    </Link>
                    <Popconfirm
                        title={`Delete the user ${user.fullName}?`}
                        description="This action cannot be undone."
                        onConfirm={() => onDelete(user)}
                        okText="Yes"
                        cancelText="No"
                    >
                        <Button type="text" danger>
                            Delete
                        </Button>
                    </Popconfirm>
                </>
            ),
        },
    ]
}

export function UsersIndexPage(): React.ReactElement {
    const { admin } = useContext(AdminAppContext)
    const queryClient = useQueryClient()
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false)
    const [searchValue, setSearchValue] = useSearchQueryParam()

    const { data: users, isLoading } = useQuery({
        queryKey: userKeys.list(),
        queryFn: async () => {
            const { users } = await admin.getJSONInBackground<{
                users: UserIndexMetaWithLastSeen[]
            }>("/api/users.json")
            return users
        },
    })

    const deleteMutation = useMutation({
        mutationFn: (user: UserIndexMetaWithLastSeen) =>
            admin.requestJSON(`/api/users/${user.id}`, {}, "DELETE"),
        onSuccess: () =>
            queryClient.invalidateQueries({ queryKey: userKeys.all }),
    })

    const usersToShow = useMemo(
        () =>
            filterBySearchWords(users ?? [], searchValue, (user) => [
                user.fullName,
            ]),
        [users, searchValue]
    )

    const columns = useMemo(
        () =>
            createColumns({
                isSuperuser: admin.isSuperuser,
                onDelete: deleteMutation.mutate,
            }),
        [admin.isSuperuser, deleteMutation.mutate]
    )

    return (
        <AdminLayout title="Users">
            <main className="UsersIndexPage">
                {isInviteModalOpen && (
                    <InviteModal
                        onClose={() => {
                            setIsInviteModalOpen(false)
                            void queryClient.invalidateQueries({
                                queryKey: userKeys.all,
                            })
                        }}
                    />
                )}
                <AdminTable
                    columns={columns}
                    dataSource={usersToShow}
                    loading={isLoading}
                    entityName="users"
                    search={{
                        value: searchValue,
                        onChange: setSearchValue,
                        placeholder: "Search users...",
                        width: 300,
                    }}
                    actions={
                        admin.isSuperuser && (
                            <Button
                                type="primary"
                                onClick={() => setIsInviteModalOpen(true)}
                            >
                                Add a user
                            </Button>
                        )
                    }
                />
            </main>
        </AdminLayout>
    )
}
