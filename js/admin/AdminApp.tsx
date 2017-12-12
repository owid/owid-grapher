import * as React from 'react'
import Admin from './Admin'
import ChartEditorPage from './ChartEditorPage'

export default class AdminApp extends React.Component<{ admin: Admin }> {
    render() {
        const {admin} = this.props

        const m = admin.currentPath.match(/\/charts\/(\d+)\/edit/)
        const chartId = m ? parseInt(m[1]) : undefined

        const adminRootUrl = "/grapher/admin"

        return <div className="AdminApp">
            <nav className="navbar navbar-dark bg-dark flex-row">
                <a className="navbar-brand" href={adminRootUrl}>owid-grapher</a>
                <ul className="navbar-nav ml-auto">
                    <li className="nav-item">
                        <a className="nav-link" href={`${adminRootUrl}/charts/create`}>
                            <i className="fa fa-plus"/> New chart
                        </a>
                    </li>
                </ul>
            </nav>
            {/*<Menu inverted borderless fluid>
                <Menu.Item>
                    <a href={adminRootUrl}>owid-grapher</a>
                </Menu.Item>
                <Menu.Item position='right'>
                    <a href=>
                        <Icon name='plus'/>
                        New chart
                    </a>
                </Menu.Item>
            </Menu>*/}
            <ChartEditorPage admin={admin} chartId={chartId}/>
        </div>
    }
}
