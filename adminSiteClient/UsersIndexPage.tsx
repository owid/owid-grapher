import * as React from "react"
import { observer } from "mobx-react"
import { observable, action, computed, runInAction, makeObservable } from "mobx"

import { Alert, Button, Input, Table, TableColumnsType } from "antd"
import { Modal, Timeago } from "./Forms.js"
import { LinkButton } from "./Link.js"
import { AdminLayout } from "./AdminLayout.js"
import { AdminAppContext, AdminAppContextType } from "./AdminAppContext.js"
import { UserIndexMeta } from "./UserMeta.js"

interface UserIndexMetaWithLastSeen extends UserIndexMeta {
    lastSeen: Date
}

function compareTimes(a: Date | undefined, b: Date | undefined): number {
    return new Date(a ?? 0).getTime() - new Date(b ?? 0).getTime()
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
            console.log(resp)
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
                        <div className="form-field">
                            <label className="form-field__label">
                                Full name
                            </label>
                            <Input
                                type="text"
                                value={this.fullName}
                                onChange={action(
                                    (e: React.ChangeEvent<HTMLInputElement>) =>
                                        (this.fullName = e.currentTarget.value)
                                )}
                                required
                            />
                        </div>
                        <div className="form-field">
                            <label className="form-field__label">Email</label>
                            <Input
                                type="email"
                                value={this.email}
                                onChange={action(
                                    (e: React.ChangeEvent<HTMLInputElement>) =>
                                        (this.email = e.currentTarget.value)
                                )}
                                required
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <Button type="primary" htmlType="submit">
                            Add user
                        </Button>
                    </div>
                    {this.responseSuccess && (
                        <Alert
                            type="success"
                            title="User added! They can now log in with their G Suite account."
                        />
                    )}
                </form>
            </Modal>
        )
    }
}

@observer
export class UsersIndexPage extends React.Component {
    static override contextType = AdminAppContext
    declare context: AdminAppContextType

    users: UserIndexMetaWithLastSeen[] = []
    isInviteModal: boolean = false

    constructor(props: Record<string, never>) {
        super(props)

        makeObservable(this, {
            users: observable,
            isInviteModal: observable,
        })
    }

    @action.bound async onDelete(user: UserIndexMetaWithLastSeen) {
        if (
            !window.confirm(
                `Delete the user ${user.fullName}? This action cannot be undone!`
            )
        )
            return

        const json = await this.context.admin.requestJSON(
            `/api/users/${user.id}`,
            {},
            "DELETE"
        )

        if (json.success) {
            runInAction(() => this.users.splice(this.users.indexOf(user), 1))
        }
    }

    @computed get columns(): TableColumnsType<UserIndexMetaWithLastSeen> {
        const { isSuperuser } = this.context.admin
        const columns: TableColumnsType<UserIndexMetaWithLastSeen> = [
            {
                title: "Name",
                dataIndex: "fullName",
                sorter: (a, b) => a.fullName.localeCompare(b.fullName),
            },
            {
                title: "Last Seen",
                dataIndex: "lastSeen",
                sorter: (a, b) => compareTimes(a.lastSeen, b.lastSeen),
                render: (lastSeen: Date) => <Timeago time={lastSeen} />,
            },
            {
                title: "Joined",
                dataIndex: "createdAt",
                sorter: (a, b) => compareTimes(a.createdAt, b.createdAt),
                render: (createdAt: Date) => <Timeago time={createdAt} />,
            },
        ]

        if (isSuperuser) {
            columns.push(
                {
                    title: "Status",
                    dataIndex: "isActive",
                    render: (isActive: boolean) =>
                        isActive ? "active" : "disabled",
                },
                {
                    title: "",
                    key: "edit",
                    render: (_, user) => (
                        <LinkButton type="primary" to={`/users/${user.id}`}>
                            Edit
                        </LinkButton>
                    ),
                },
                {
                    title: "",
                    key: "delete",
                    render: (_, user) => (
                        <Button
                            color="danger"
                            variant="solid"
                            onClick={() => this.onDelete(user)}
                        >
                            Delete
                        </Button>
                    ),
                }
            )
        }

        return columns
    }

    override render() {
        const { users } = this
        const { isSuperuser } = this.context.admin
        return (
            <AdminLayout title="Users">
                <main className="UsersIndexPage">
                    {this.isInviteModal && (
                        <InviteModal
                            onClose={action(() => (this.isInviteModal = false))}
                        />
                    )}
                    <div className="topbar">
                        <h2>Users</h2>
                        {isSuperuser && (
                            <Button
                                type="primary"
                                onClick={action(
                                    () => (this.isInviteModal = true)
                                )}
                            >
                                Add a user
                            </Button>
                        )}
                    </div>
                    <Table
                        size="small"
                        rowKey={(user) => user.id}
                        dataSource={users}
                        pagination={false}
                        columns={this.columns}
                    />
                </main>
            </AdminLayout>
        )
    }

    async getData() {
        const { admin } = this.context

        const json = await admin.getJSON<{
            users: UserIndexMetaWithLastSeen[]
        }>("/api/users.json")

        runInAction(() => {
            this.users = json.users
        })
    }

    override componentDidMount() {
        void this.getData()
    }
}
