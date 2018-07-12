import Admin from './Admin'
import * as React from 'react'
import {observer} from 'mobx-react'
import {observable, computed, action, runInAction} from 'mobx'

import { Modal } from './Forms'
import Link from './Link'
import AdminLayout from './AdminLayout'


interface UserIndexMeta {
    id: number
    name: string
    fullName: string
    createdAt: Date
    updatedAt: Date
    isActive: boolean
}

const timeago = require('timeago.js')()

@observer
class InviteModal extends React.Component<{ onClose: () => void }> {
    context!: { admin: Admin }
    emailInput: HTMLInputElement|null = null

    @observable email: string = ""
    @observable inviteSuccess: boolean = false

    async submit() {
        runInAction(() => this.inviteSuccess = false)
        if (this.email) {
            const resp = await this.context.admin.requestJSON("/api/users/invite", { email: this.email }, "POST")
            console.log(resp)
            if (resp.success) {
                runInAction(() => this.inviteSuccess = true)
            }
        }
    }

    componentDidMount() {
        if (this.emailInput)
            this.emailInput.focus()
    }

    render() {
        return <Modal onClose={this.props.onClose}>
            <form onSubmit={e => { e.preventDefault(); this.submit() } }>
                <div className="modal-header">
                    <h5 className="modal-title">Invite a user</h5>
                </div>
                <div className="modal-body">
                    <div className="form-group">
                        <label>Email address to invite</label>
                        <input type="email" className="form-control" onInput={e => this.email = e.currentTarget.value} required ref={e => this.emailInput = e}/>
                    </div>
                </div>
                <div className="modal-footer">
                    <input type="submit" className="btn btn-primary">Send invite</input>
                </div>
                {this.inviteSuccess && <div className="alert alert-success" role="alert">
                    Invite sent!
                </div>}
            </form>
        </Modal>
    }
}

@observer
export default class UsersIndexPage extends React.Component {
    context!: { admin: Admin }
    @observable users: UserIndexMeta[] = []
    @observable isInviteModal: boolean = false

    @action.bound async onDelete(user: UserIndexMeta) {
        if (!window.confirm(`Delete the user ${user.name}? This action cannot be undone!`))
            return

        const json = await this.context.admin.requestJSON(`/api/users/${user.id}`, {}, "DELETE")

        if (json.success) {
            runInAction(() => this.users.splice(this.users.indexOf(user), 1))
        }
    }

    render() {
        const {users} = this
        return <AdminLayout title="Users">
            <main className="UsersIndexPage">
                {this.isInviteModal && <InviteModal onClose={action(() => this.isInviteModal = false)}/>}
                <div className="topbar">
                    <h2>Users</h2>
                    <button onClick={action(() => this.isInviteModal = true)} className="btn btn-primary">Invite a user</button>
                </div>
                <table className="table table-bordered">
                    <tr>
                        <th>Username</th>
                        <th>Full Name</th>
                        <th>Joined</th>
                        <th>Status</th>
                        <th></th>
                        <th></th>
                    </tr>
                    {users.map(user =>
                        <tr>
                            <td>{user.name}</td>
                            <td>{user.fullName}</td>
                            <td>{timeago.format(user.createdAt)}</td>
                            <td>{user.isActive ? 'active' : 'inactive'}</td>
                            <td>
                                <Link to={`/users/${user.id}`} className="btn btn-primary">Edit</Link>
                            </td>
                            <td>
                                <button className="btn btn-danger" onClick={_ => this.onDelete(user)}>Delete</button>
                            </td>
                        </tr>
                    )}
                </table>
            </main>
        </AdminLayout>
    }

    async getData() {
        const {admin} = this.context

        const json = await admin.getJSON("/api/users.json") as { users: UserIndexMeta[] }


        runInAction(() => {
            this.users = json.users
        })
    }

    componentDidMount() {
        this.getData()
    }
}
