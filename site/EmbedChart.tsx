import React from "react"
import { observer } from "mobx-react"
import {
    computed,
    observable,
    runInAction,
    autorun,
    IReactionDisposer,
    makeObservable,
} from "mobx";
import { Grapher } from "../grapher/core/Grapher.js"
import { GrapherFigureView } from "./GrapherFigureView.js"
import { deserializeJSONFromHTML } from "../clientUtils/serializers.js"
import { Url } from "../clientUtils/urls/Url.js"

export const EmbedChart = observer(class EmbedChart extends React.Component<{ src: string }> {
    constructor(props: { src: string }) {
        super(props);

        makeObservable<EmbedChart, "url" | "configUrl" | "queryStr" | "grapher">(this, {
            url: computed,
            configUrl: computed,
            queryStr: computed,
            grapher: observable
        });
    }

    private get url(): Url {
        return Url.fromURL(this.props.src)
    }
    private get configUrl() {
        return this.url.originAndPath
    }
    private get queryStr() {
        return this.url.queryStr
    }
    private grapher?: Grapher;

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
});
