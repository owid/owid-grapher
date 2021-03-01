import * as React from "react"
import { observer } from "mobx-react"
import {
    computed,
    observable,
    runInAction,
    autorun,
    IReactionDisposer,
} from "mobx"
import { Grapher } from "../grapher/core/Grapher"
import { GrapherFigureView } from "./GrapherFigureView"
import { deserializeJSONFromHTML } from "../clientUtils/serializers"
import { Url } from "../clientUtils/urls/Url"
import { excludeUndefined } from "../clientUtils/Util"

@observer
export class EmbedChart extends React.Component<{ src: string }> {
    @computed private get url(): Url {
        return Url.fromURL(this.props.src)
    }
    @computed private get configUrl() {
        return this.url.baseAndPath
    }
    @computed private get queryStr() {
        return this.url.queryStr
    }
    @observable private grapher?: Grapher

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
