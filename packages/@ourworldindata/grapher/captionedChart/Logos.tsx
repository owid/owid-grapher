import React from "react"
import { computed } from "mobx"
import { OWID_LOGO_SVG, CORE_LOGO_SVG, GV_LOGO_SVG } from "./LogosSVG.js"

export enum LogoOption {
    owid = "owid",
    "core+owid" = "core+owid",
    "gv+owid" = "gv+owid",
}

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
    logo?: LogoOption
    isLink: boolean
    fontSize: number
}

export class Logo {
    props: LogoProps
    constructor(props: LogoProps) {
        this.props = props
    }

    @computed private get spec(): LogoAttributes {
        return this.props.logo !== undefined
            ? logos[this.props.logo]
            : logos.owid
    }

    @computed private get scale(): number {
        return this.spec.targetHeight / this.spec.height
    }

    @computed get width(): number {
        return this.spec.width * this.scale
    }
    @computed get height(): number {
        return this.spec.height * this.scale
    }

    renderSVG(targetX: number, targetY: number): JSX.Element {
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

    renderHTML(): JSX.Element {
        const { spec } = this
        const props: React.HTMLAttributes<HTMLElement> = {
            className: "logo",
            dangerouslySetInnerHTML: { __html: spec.svg },
            style: { height: `${spec.targetHeight}px` },
        }
        if (this.props.isLink || !spec.url) return <div {...props} />
        return <a {...props} href={spec.url} target="_blank" rel="noopener" />
    }
}
