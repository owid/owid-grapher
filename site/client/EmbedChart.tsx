import * as React from "react"
import { observer } from "mobx-react"
import {
    computed,
    observable,
    runInAction,
    autorun,
    IReactionDisposer,
} from "mobx"
import { Grapher } from "grapher/core/Grapher"
import { GrapherFigureView } from "./GrapherFigureView"
import { splitURLintoPathAndQueryString } from "utils/client/url"
import { deserializeJSONFromHTML } from "utils/serializers"

@observer
export class EmbedChart extends React.Component<{ src: string }> {
    @computed private get configUrl() {
        return splitURLintoPathAndQueryString(this.props.src).path
    }
    @computed private get queryStr() {
        return splitURLintoPathAndQueryString(this.props.src).queryString
    }
    @observable private grapher?: Grapher

    private async loadConfig() {
        const { configUrl } = this
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
            <GrapherFigureView grapher={this.grapher} />
        ) : (
            <figure data-grapher-src={this.props.src} />
        )
    }
}
