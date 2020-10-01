import * as React from "react"
import { computed } from "mobx"
import { OWID_LOGO_SVG, CORE_LOGO_SVG, GV_LOGO_SVG } from "./LogosSVG"

export type LogoOption = "owid" | "core+owid" | "gv+owid"

interface LogoAttributes {
    svg: string
    width: number
    height: number
    targetHeight: number
    url?: string
}

const logos: Record<LogoOption, LogoAttributes> = {
    owid: {
        svg: OWID_LOGO_SVG,
        width: 210,
        height: 120,
        targetHeight: 35,
        url: "https://ourworldindata.org",
    },
    "core+owid": {
        svg: CORE_LOGO_SVG,
        width: 102,
        height: 37,
        targetHeight: 35,
    },
    "gv+owid": {
        svg: GV_LOGO_SVG,
        width: 420,
        height: 350,
        targetHeight: 52,
    },
}

interface LogoProps {
    logo: LogoOption | undefined
    isLink: boolean
    fontSize: number
}

export class Logo {
    props: LogoProps
    constructor(props: LogoProps) {
        this.props = props
    }

    @computed get spec() {
        return this.props.logo !== undefined
            ? logos[this.props.logo]
            : logos.owid
    }

    @computed get scale(): number {
        return this.spec.targetHeight / this.spec.height
    }

    @computed get width() {
        return this.spec.width * this.scale
    }
    @computed get height() {
        return this.spec.height * this.scale
    }

    renderSVG(targetX: number, targetY: number) {
        const { scale } = this
        const svg =
            (this.spec.svg.match(/<svg>(.*)<\/svg>/) || "")[1] || this.spec.svg
        return (
            <g
                transform={`translate(${Math.round(
                    targetX
                )}, ${targetY}) scale(${parseFloat(scale.toFixed(2))})`}
                dangerouslySetInnerHTML={{ __html: svg }}
            />
        )
    }

    renderHTML() {
        const props: React.HTMLAttributes<
            HTMLDivElement & HTMLAnchorElement
        > = {
            className: "logo",
            dangerouslySetInnerHTML: { __html: this.spec.svg },
            style: { height: `${this.spec.targetHeight}px` },
        }
        if (this.props.isLink || !this.spec.url) {
            return <div {...props} />
        } else {
            return (
                <a
                    {...props}
                    href={this.spec.url}
                    target="_blank"
                    rel="noopener"
                />
            )
        }
    }
}
