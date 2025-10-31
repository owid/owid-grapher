import * as React from "react"
import {
    OWID_LOGO_SVG,
    CORE_LOGO_SVG,
    GV_LOGO_SVG,
    SMALL_OWID_LOGO_SVG,
} from "./LogosSVG"
import { LogoOption } from "@ourworldindata/types"
import { makeIdForHumanConsumption } from "@ourworldindata/utils"

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
        width: 65,
        height: 36,
        targetHeight: 36,
        url: "https://ourworldindata.org",
    },
    "core+owid": {
        svg: CORE_LOGO_SVG,
        width: 102,
        height: 37,
        targetHeight: 36,
    },
    "gv+owid": {
        svg: GV_LOGO_SVG,
        width: 420,
        height: 350,
        targetHeight: 52,
    },
}

// owid logo optimized for small sizes
const smallOwidLogo = {
    svg: SMALL_OWID_LOGO_SVG,
    width: 51,
    height: 28,
    targetHeight: 28,
    url: "https://ourworldindata.org",
}

interface LogoProps {
    logo?: LogoOption
    isLink: boolean
    heightScale?: number
    useSmallVersion?: boolean
}

export class Logo {
    props: LogoProps
    constructor(props: LogoProps) {
        this.props = props
    }

    private get logo(): LogoOption {
        return this.props.logo ?? LogoOption.owid
    }

    private get spec(): LogoAttributes {
        if (this.props.useSmallVersion && this.logo === LogoOption.owid) {
            return smallOwidLogo
        }
        return logos[this.logo]
    }

    private get targetHeight(): number {
        return (this.props.heightScale ?? 1) * this.spec.targetHeight
    }

    private get scale(): number {
        return this.targetHeight / this.spec.height
    }

    get width(): number {
        return this.spec.width * this.scale
    }
    get height(): number {
        return this.spec.height * this.scale
    }

    renderSVG(targetX: number, targetY: number): React.ReactElement {
        const { scale } = this
        const svg =
            (this.spec.svg.match(/<svg>(.*)<\/svg>/) || "")[1] || this.spec.svg
        return (
            <g
                id={makeIdForHumanConsumption("logo")}
                transform={`translate(${Math.round(
                    targetX
                )}, ${targetY}) scale(${parseFloat(scale.toFixed(2))})`}
                dangerouslySetInnerHTML={{ __html: svg }}
            />
        )
    }

    renderHTML(): React.ReactElement {
        const { spec } = this
        const props: React.HTMLAttributes<HTMLElement> = {
            className: "logo",
            dangerouslySetInnerHTML: { __html: spec.svg },
            style: { height: `${this.targetHeight}px` },
        }
        if (this.props.isLink && spec.url)
            return <a {...props} href={spec.url} rel="noopener" />
        else return <div {...props} />
    }
}
