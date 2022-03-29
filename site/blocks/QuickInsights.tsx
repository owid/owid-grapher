import React, { ReactElement, useContext, useRef, useState } from "react"
import ReactDOMServer from "react-dom/server"
import ReactDOM from "react-dom"
import { useEmbedChart } from "../hooks.js"
import { ScrollMenu, VisibilityContext } from "react-horizontal-scrolling-menu"
import { WP_BlockType } from "../../clientUtils/owidTypes.js"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { faAngleRight } from "@fortawesome/free-solid-svg-icons/faAngleRight"

export const CLASS_NAME = "quick-insights"

type scrollVisibilityApiType = React.ContextType<typeof VisibilityContext>

const Thumb = ({
    title,
    onClick,
    selected,
}: {
    title: string
    itemId: string
    onClick: (visibility: scrollVisibilityApiType) => void
    selected: boolean
}) => {
    const visibility = useContext(VisibilityContext)

    return (
        <button
            onClick={() => onClick(visibility)}
            className={selected ? "thumb selected" : "thumb"}
        >
            {title}
        </button>
    )
}

const QuickInsights = () => {
    const [selectedId, setSelectedId] = useState<string>("0")
    const refChartContainer = useRef<HTMLDivElement>(null)

    const handleThumbClickFactory = (itemId: string) => {
        return ({ scrollToItem, getItemById }: scrollVisibilityApiType) => {
            setSelectedId(itemId)
            scrollToItem(getItemById(itemId), "smooth", "center", "nearest")
        }
    }

    useEmbedChart(selectedId, refChartContainer)

    return (
        <div className={CLASS_NAME}>
            <div className="thumbs">
                <ScrollMenu LeftArrow={LeftArrow} RightArrow={RightArrow}>
                    {insights.map(({ title }, i) => {
                        const itemId = `${i}`
                        return (
                            <Thumb
                                title={title}
                                key={itemId}
                                itemId={itemId}
                                onClick={handleThumbClickFactory(itemId)}
                                selected={itemId === selectedId}
                            />
                        )
                    })}
                </ScrollMenu>
            </div>
            <div className="content" ref={refChartContainer}>
                {insights[Number(selectedId)].slide}
            </div>
        </div>
    )
}

const Arrow = ({
    children,
    disabled,
    onClick,
    className,
}: {
    children: React.ReactNode
    disabled: boolean
    onClick: VoidFunction
    className?: string
}) => {
    const classes = ["arrow", className]
    return (
        <button
            disabled={disabled}
            onClick={onClick}
            className={classes.join(" ")}
        >
            {children}
        </button>
    )
}

const LeftArrow = () => {
    const {
        isFirstItemVisible,
        scrollPrev,
        visibleItemsWithoutSeparators,
        initComplete,
    } = React.useContext(VisibilityContext)

    const [disabled, setDisabled] = React.useState(
        !initComplete || (initComplete && isFirstItemVisible)
    )
    React.useEffect(() => {
        // NOTE: detect if whole component visible
        if (visibleItemsWithoutSeparators.length) {
            setDisabled(isFirstItemVisible)
        }
    }, [isFirstItemVisible, visibleItemsWithoutSeparators])

    return (
        <Arrow
            disabled={disabled}
            onClick={() => scrollPrev()}
            className="left"
        >
            <FontAwesomeIcon icon={faAngleRight} flip="horizontal" />
        </Arrow>
    )
}

const RightArrow = () => {
    const { isLastItemVisible, scrollNext, visibleItemsWithoutSeparators } =
        React.useContext(VisibilityContext)

    const [disabled, setDisabled] = React.useState(
        !visibleItemsWithoutSeparators.length && isLastItemVisible
    )
    React.useEffect(() => {
        if (visibleItemsWithoutSeparators.length) {
            setDisabled(isLastItemVisible)
        }
    }, [isLastItemVisible, visibleItemsWithoutSeparators])

    return (
        <Arrow
            disabled={disabled}
            onClick={() => scrollNext()}
            className="right"
        >
            <FontAwesomeIcon icon={faAngleRight} />
        </Arrow>
    )
}

export const renderQuickInsights = ($: CheerioStatic) => {
    $("block[type='quick-insights']").each(function (this: CheerioElement) {
        const $block = $(this)

        const rendered = ReactDOMServer.renderToString(
            <div className={`block-wrapper ${WP_BlockType.FullContentWidth}`}>
                <QuickInsights />
            </div>
        )
        $block.after(rendered)
        $block.remove()
    })
}

export const hydrateQuickInsights = () => {
    document
        .querySelectorAll<HTMLElement>(`.${CLASS_NAME}`)
        .forEach((block) => {
            const blockWrapper = block.parentElement
            ReactDOM.hydrate(<QuickInsights />, blockWrapper)
        })
}

const insights: { title: string; slide: ReactElement }[] = [
    {
        title: "The extent of poverty today",
        slide: (
            <div className="wp-block-columns is-style-sticky-right">
                <div className="wp-block-column">
                    <h4>The extent of poverty today</h4>
                    <p>
                        The chart here shows the share of the world population
                        with an income falling below three different poverty
                        lines. The highest poverty line shown is $30 a day. This
                        is roughly equivalent to the poverty lines adopted
                        nationally in high-income countries.1 We see that,
                        measured against definitions of poverty typical in
                        high-income countries, the vast majority of the world’s
                        population – 85% – are poor.
                    </p>
                    <p>
                        But many in the world are far, far poorer than this
                        threshold. The UN has adopted a poverty line of $1.90 a
                        day as its definition of extreme poverty. We see that
                        roughly every tenth person in the world lives in such
                        extreme poverty today.
                    </p>
                    <h5>Methods & data quality </h5>
                    <p>
                        Extreme poverty here is defined according to the UN’s
                        definition of living on less than $1.90 a day – an
                        extremely low threshold needed to monitor and draw
                        attention to the living conditions of the poorest around
                        the world. [Read more] The data is available only up to
                        2019 (or 2017 for global estimates), and hence does not
                        allow us to see the impact of the COVID-19 pandemic and
                        global recession. [Read more] Global data relies on a
                        mix of income and expenditure household surveys.
                    </p>
                    <p>
                        [Read more] Surveys are not conducted every year in most
                        countries, and coverage is generally lower for poorer
                        countries and for earlier decades. Estimates for
                        non-survey years are made by projecting the survey-year
                        data forward or backwards using national accounts data.
                        [Read more] Data is measured in 2011 international-$,
                        which means that inflation and differences in purchasing
                        power across countries are taken into account. [Read
                        more] Non-market sources of income, including food grown
                        by subsistence farmers for their own consumption, are
                        taken into account.
                    </p>
                </div>
                <div className="wp-block-column">
                    <figure
                        key="number-of-deaths-by-risk-factor"
                        data-grapher-src="/grapher/number-of-deaths-by-risk-factor"
                    />
                </div>
            </div>
        ),
    },
    {
        title: "Global extreme poverty fell rapidly over the last generation",
        slide: (
            <figure
                key="number-of-deaths-by-risk-factor"
                data-grapher-src="/grapher/number-of-deaths-by-risk-factor"
            />
        ),
    },
    {
        title: "The extent of poverty today",
        slide: (
            <figure
                key="number-of-deaths-by-risk-factor"
                data-grapher-src="/grapher/number-of-deaths-by-risk-factor"
            />
        ),
    },
    {
        title: "The extent of poverty today",
        slide: (
            <figure
                key="number-of-deaths-by-risk-factor"
                data-grapher-src="/grapher/number-of-deaths-by-risk-factor"
            />
        ),
    },
    {
        title: "The extent of poverty today",
        slide: (
            <figure
                key="number-of-deaths-by-risk-factor"
                data-grapher-src="/grapher/number-of-deaths-by-risk-factor"
            />
        ),
    },
    {
        title: "The extent of poverty today",
        slide: (
            <figure
                key="number-of-deaths-by-risk-factor"
                data-grapher-src="/grapher/number-of-deaths-by-risk-factor"
            />
        ),
    },
    {
        title: "The extent of poverty today",
        slide: (
            <figure
                key="number-of-deaths-by-risk-factor"
                data-grapher-src="/grapher/number-of-deaths-by-risk-factor"
            />
        ),
    },
]
