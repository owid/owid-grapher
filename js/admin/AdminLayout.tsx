import * as React from 'react'
import {observable, action} from 'mobx'
import {observer} from 'mobx-react'

import Link from './Link'
import Admin from './Admin'
import EditorFAQ from './EditorFAQ'
import AdminSidebar from './AdminSidebar'

@observer
class FixedOverlay extends React.Component<{ onDismiss: () => void }> {
    base!: HTMLDivElement
    @action.bound onClick(e: React.MouseEvent<HTMLDivElement>) {
        if (e.target === this.base)
            this.props.onDismiss()
    }

    render() {
        return <div className="FixedOverlay" onClick={this.onClick}>
            {this.props.children}
        </div>
    }
}

@observer
export default class AdminLayout extends React.Component<{ noSidebar?: boolean, title?: string, children: any }> {
    context!: { admin: Admin }

    @observable isFAQ: boolean = false
    @observable isSidebar: boolean = false

    @action.bound onToggleFAQ() {
        this.isFAQ = !this.isFAQ
    }

    @action.bound onToggleSidebar() {
        this.isSidebar = !this.isSidebar
    }

    componentDidMount() {
        this.isSidebar = !this.props.noSidebar
        this.componentDidUpdate()
    }

    componentDidUpdate() {
        if (this.props.title)
            document.title = this.props.title + " - owid-admin"
        else
            document.title = "owid-admin"
    }

    render() {
        const {admin} = this.context
        const {isFAQ, isSidebar} = this

        return <div className={"AdminLayout" + (isSidebar ? " withSidebar" : "")}>
            {isFAQ && <EditorFAQ onClose={this.onToggleFAQ}/>}
            <nav className="navbar navbar-dark bg-dark flex-row navbar-expand-lg">
                <button className="navbar-toggler" type="button" onClick={this.onToggleSidebar}>
                    <span className="navbar-toggler-icon"></span>
                </button>
                <Link className="navbar-brand" to="/">owid-admin</Link>
                <ul className="navbar-nav">
                    <li className="nav-item">
                        <Link className="nav-link" to="/charts/create">
                            <i className="fa fa-plus"/> New chart
                        </Link>
                    </li>
                    <li className="nav-item">
                        <a className="nav-link" onClick={this.onToggleFAQ}>
                            FAQ
                        </a>
                    </li>
                    <li className="nav-item">
                        <a className="nav-link" href="/wp-admin" target="_blank">
                            Wordpress
                        </a>
                    </li>
                </ul>
                <ul className="navbar-nav ml-auto">
                    <li className="nav-item">
                        <a className="nav-link logout" href="/grapher/admin/logout">
                            {admin.username}
                        </a>
                    </li>
                </ul>
                {/* This lets the public frontend know to show edit links and such */}
                <iframe src="https://ourworldindata.org/identifyadmin" style={{display: 'none'}}/>
            </nav>
            {isSidebar && <AdminSidebar onDismiss={this.onToggleSidebar}/>}
            {this.props.children}
        </div>
    }
}
