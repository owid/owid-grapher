import { ChartConfig } from "charts/ChartConfig"
import {
    autorun,
    computed,
    IReactionDisposer,
    observable,
    runInAction
} from "mobx"
import { observer } from "mobx-react"
import * as React from "react"
import { readConfigFromHTML } from "site/client/Grapher"

import { ChartFigureView } from "./ChartFigureView"
@observer
export class EmbedChart extends React.Component<{ src: string }> {
    @computed get configUrl(): string {
        return this.props.src.split(/\?/)[0]
    }
    @computed get queryStr(): string {
        return this.props.src.split(/\?/)[1]
    }
    @observable chart?: ChartConfig

    async loadConfig() {
        const { configUrl } = this
        const resp = await fetch(configUrl)
        if (this.configUrl !== configUrl) {
            // Changed while we were fetching
            return
        }

        const html = await resp.text()
        const config = readConfigFromHTML(html)
        runInAction(() => {
            this.chart = new ChartConfig(config, {
                isEmbed: true,
                queryStr: this.queryStr
            })
        })
    }

    dispose?: IReactionDisposer
    componentDidMount() {
        this.dispose = autorun(() => this.props.src && this.loadConfig())
    }

    componentWillUnmount() {
        if (this.dispose) this.dispose()
    }

    render() {
        return this.chart ? (
            <ChartFigureView chart={this.chart} />
        ) : (
            <figure data-grapher-src={this.props.src} />
        )
    }
}
