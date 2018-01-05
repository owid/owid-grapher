import * as React from 'react'
import {observable, runInAction} from 'mobx'
import {observer} from 'mobx-react'
const timeago = require('timeago.js')()

import Admin from './Admin'

interface BuildStatus {
    state: string
    created_at: string
    updated_at: string
    published_at: string
    admin_url: string
    id: string
}

@observer
export default class GrapherBuildStatus extends React.Component {
    context: { admin: Admin }

    @observable buildStatus?: BuildStatus

    request?: Promise<any>
    async updateStatus() {
        try {
            this.request = this.context.admin.rawRequest("/api/buildStatus.json", {}, "GET")
            const response = await this.request
            const json = await response.json()
            runInAction(() => this.buildStatus = json)
        } catch (err) {
            this.buildStatus = undefined
            console.error(err)
        } finally {
            this.request = undefined
        }
    }

    interval: NodeJS.Timer
    componentDidMount() {
        this.interval = setInterval(() => {
            if (!this.request)
                this.updateStatus()
        }, 10000)
        this.updateStatus()
    }

    componentWillUnmount() {
        clearInterval(this.interval)
    }

    render() {
        const {buildStatus} = this
        if (!buildStatus)
            return null

        return <a className="nav-link" href={`${buildStatus.admin_url}/deploys/${buildStatus.id}`} target="_blank">
            {buildStatus.state === "ready" && <span>Last static build: {timeago.format(buildStatus.published_at)}</span>}
            {(buildStatus.state === "building" || buildStatus.state === "processing") && <span>Static build started {timeago.format(buildStatus.created_at)}...</span>}
            {(buildStatus.state === "failed" || buildStatus.state === "retrying" || buildStatus.state === "error") && <span>Build error: {timeago.format(buildStatus.updated_at)}</span>}
        </a>
    }
}