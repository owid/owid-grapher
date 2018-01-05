import * as React from 'react'
import Admin from './Admin'
import ChartEditorPage from './ChartEditorPage'
import {observable, action} from 'mobx'
import {observer} from 'mobx-react'
import { EditorFAQ } from './EditorFAQ'
import ChartIndexPage from './ChartIndexPage'
import AdminSidebar from './AdminSidebar'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'
import Link from './Link'
import { LoadingBlocker, Modal } from './Forms'

@observer
class FixedOverlay extends React.Component<{ onDismiss: () => void }> {
    base: HTMLDivElement
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
class AdminErrorMessage extends React.Component<{ admin: Admin }> {
    render() {
        const {admin} = this.props
        const error = admin.errorMessage

        return error ? <Modal className="errorMessage" onClose={action(() => { error.isFatal ? window.location.reload() : admin.errorMessage = undefined })}>
            <div className="modal-header">
                <div>
                    <h5 className="modal-title" style={error.isFatal ? { color: 'red' } : undefined}>{error.title}</h5>
                    {error.isFatal && <p>Please screenshot this error message and report it in <a href="https://owid.slack.com/messages/tiny-tech-problems/">#tiny-tech-problems</a></p>}
                </div>
            </div>
            <div className="modal-body" dangerouslySetInnerHTML={{__html: error.content}}/>
        </Modal> : null
    }
}

@observer
class AdminLoader extends React.Component<{ admin: Admin }> {
    render() {
        const {admin} = this.props
        return admin.isLoading ? <LoadingBlocker/> : null
    }
}

@observer
export default class AdminApp extends React.Component<{ admin: Admin }> {
    @observable isFAQ: boolean = false
    @observable isSidebar: boolean = false

    @action.bound onToggleFAQ() {
        this.isFAQ = !this.isFAQ
    }

    @action.bound onToggleSidebar() {
        this.isSidebar = !this.isSidebar
    }

    getChildContext() {
        return { admin: this.props.admin }
    }

    render() {
        const {admin} = this.props
        const {isFAQ, isSidebar} = this

        return <Router basename={admin.basePath}>
            <div className="AdminApp">
                <nav className="navbar navbar-dark bg-dark flex-row navbar-expand-lg">
                    <button className="navbar-toggler" type="button" onClick={this.onToggleSidebar}>
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    <Link className="navbar-brand" to="/">owid-grapher</Link>
                    <ul className="navbar-nav">
                        <li className="nav-item">
                            <Link className="nav-link" to="/charts/create" native>
                                <i className="fa fa-plus"/> New chart
                            </Link>
                        </li>
                        <li className="nav-item">
                            <a className="nav-link" onClick={this.onToggleFAQ}>
                                FAQ
                            </a>
                        </li>
                    </ul>
                    <ul className="navbar-nav ml-auto">
                        <li className="nav-item">
                            <Link className="nav-link logout" to="/logout" native>
                                {admin.username}
                            </Link>
                        </li>
                    </ul>
                </nav>
                {isFAQ && <EditorFAQ onClose={this.onToggleFAQ}/>}
                <AdminErrorMessage admin={admin}/>
                <AdminLoader admin={admin}/>
                {isSidebar && <FixedOverlay onDismiss={this.onToggleSidebar}><AdminSidebar/></FixedOverlay>}
                <Switch>
                    <Route path="/charts/create" component={ChartEditorPage}/>
                    <Route path="/charts/:chartId/edit" render={({ match }) => <ChartEditorPage chartId={parseInt(match.params.chartId)}/>}/>
                    <Route path="/" component={ChartIndexPage}/>
                </Switch>
            </div>
        </Router>
    }
}
