The computation used to train each notable AI model, as a scatter by publication date, with the data from OWID's "Notable AI models" multidim. Reach for it in articles about the growth of AI training, where a narrower time range, fixed axis ends or the uncertainty of the estimates help make a point.

```archie
{.bespoke-component}
  bundle: ai-training-compute
  variant: scatter
  size: wide
{}
```

```archie
{.bespoke-component}
  bundle: ai-training-compute
  variant: scatter
  size: wide
  {.config}
    title: Training computation of AI models since 2010
    startYear: 2010
    yAxisMin: 1e15
    colorBy: developer
    hideColorBy: true
  {}
{}
```

```archie
{.bespoke-component}
  bundle: ai-training-compute
  variant: scatter
  size: wide
  {.config}
    startYear: 2018
    yScale: linear
    hideYScaleToggle: true
    showUncertainty: true
  {}
{}
```

## Notes

The y-axis ends take a number of FLOP in any common notation: `1e24`, `10^24`, `10²⁴` or `3 × 10^24`. Note that `10e24` means 10 × 10²⁴, which is 10²⁵.

Without an authored subtitle, the chart uses the multidim's subtitle for the current color, which explains what the colors show, so it changes when a reader switches the color.

The uncertainty ranges come from Epoch AI's confidence in each estimate (within 3×, 10× or 31× either way, as 90% intervals). The OWID data doesn't carry the confidence label yet, so the bundle looks it up by model name in a file generated from Epoch AI's data; a model new to the OWID data shows no range until that file is regenerated.
