import { Grapher } from "@ourworldindata/grapher"
import { deserializeJSONFromHTML, Url } from "@ourworldindata/utils"
import {
    autorun,
    computed,
    IReactionDisposer,
    observable,
    runInAction,
} from "mobx"
import { observer } from "mobx-react"
import React from "react"
import { GrapherFigureView } from "./GrapherFigureView.js"

@observer
export class EmbedChart extends React.Component<{ src: string }> {
    @computed private get url(): Url {
        return Url.fromURL(this.props.src)
    }
    @computed private get configUrl() {
        return this.url.originAndPath
    }
    @computed private get queryStr() {
        return this.url.queryStr
    }
    @observable private grapher?: Grapher
    @observable private currentUrl?: string

    private async loadConfig() {
        const { configUrl } = this
        if (configUrl === undefined) return
        const resp = await fetch(configUrl)
        if (this.configUrl !== configUrl) {
            // Changed while we were fetching
            return
        }

        const html = await resp.text()
        const config = deserializeJSONFromHTML(html)
        runInAction(() => {
            this.grapher = new Grapher({
                ...config,
                isEmbeddedInAnOwidPage: true,
                queryStr: this.queryStr,
            })
            // We have now loaded this url with this query string.
            // We use it as a React key, so if the url changes, we reload.
            this.currentUrl = this.props.src
        })
    }

    private dispose?: IReactionDisposer
    componentDidMount() {
        this.dispose = autorun(() => this.props.src && this.loadConfig())
    }

    componentWillUnmount() {
        if (this.dispose) this.dispose()
    }

    render() {
        return this.grapher ? (
            <GrapherFigureView key={this.currentUrl} grapher={this.grapher} />
        ) : (
            <figure data-grapher-src={this.props.src} />
        )
    }
}
