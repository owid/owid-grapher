import cx from "clsx"
import type { BespokeVariantProps } from "owid-bespoke-types"

import { useContainerWidth } from "../../../../hooks/useContainerWidth.js"

import type { IncomeDistributionConfig } from "../index.js"
import { NARROW_BREAKPOINT } from "../core/constants.js"
import { useIncomeDistributionControlsProps } from "../components/IncomeDistributionControls.js"
import {
    FetchingIncomeDistributionVariant,
    hidesControls,
    ReaderFrame,
    VariantControls,
    type CaptionedVariantProps,
} from "../components/VariantScaffold.js"

export function DistributionVariant(
    props: BespokeVariantProps<IncomeDistributionConfig>
): React.ReactElement {
    return (
        <FetchingIncomeDistributionVariant
            {...props}
            captioned={CaptionedDistributionVariant}
        />
    )
}

function CaptionedDistributionVariant(
    props: CaptionedVariantProps
): React.ReactElement {
    const { config, state } = props
    const { width, node, ref } = useContainerWidth()
    const isNarrow = width > 0 && width < NARROW_BREAKPOINT

    const controlsProps = useIncomeDistributionControlsProps({
        chartState: state.chartState,
        setters: state.setters,
        currencies: state.currencies,
        suggestedCurrency: state.suggestedCurrency,
        isNarrow,
    })

    return (
        <div
            ref={ref}
            className={cx("income-distribution", {
                "income-distribution--narrow": isNarrow,
            })}
        >
            {!hidesControls(config) && (
                // Narrow charts keep the controls in a bottom sheet, behind
                // a button
                <VariantControls
                    layout={isNarrow ? "drawer" : "card"}
                    container={node}
                    controlsProps={controlsProps}
                />
            )}
            <ReaderFrame {...props} isNarrow={isNarrow} />
        </div>
    )
}
