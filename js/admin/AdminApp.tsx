import * as React from 'react'
import Admin from './Admin'
import ChartEditorPage from './ChartEditorPage'

import { Menu, Icon } from 'semantic-ui-react'

export default class AdminApp extends React.Component<{ admin: Admin }> {
    render() {
        const {admin} = this.props

        const m = admin.currentPath.match(/\/charts\/(\d+)\/edit/)
        const chartId = m && parseInt(m[1])

        const adminRootUrl = "/grapher/admin"

        return <div className="AdminApp">
            <Menu inverted borderless fluid>
                <Menu.Item>
                    <a href={adminRootUrl}>owid-grapher</a>
                </Menu.Item>
                <Menu.Item position='right'>
                    <a href={`${adminRootUrl}/charts/create`}>
                        <Icon name='plus'/>
                        New chart
                    </a>
                </Menu.Item>
            </Menu>
            {chartId !== null && <ChartEditorPage admin={admin} chartId={chartId}/>}
        </div>
    }
}
