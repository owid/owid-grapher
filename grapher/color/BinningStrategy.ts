export enum BinningStrategy {
    equalInterval = "equalInterval",
    quantiles = "quantiles",
    ckmeans = "ckmeans",
    // The `manual` option is ignored in the algorithms below,
    // but it is stored and handled by the chart.
    manual = "manual",
}
