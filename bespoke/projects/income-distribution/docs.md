Income mountains: how the world's population is spread across income levels, from the World Bank's Poverty and Inequality Platform. The global view stacks every country by World Bank region, so the height of the mountain is the number of people living at each income. The selected-countries view draws chosen countries side by side, each normalised to the same area. Users can add a poverty line, the World Bank's international one or their own, from the controls or by clicking the chart, drag it to see the share of people below it, and switch to their local currency and to incomes per month or year.

The global view, as it starts by default:

```archie
{.bespoke-component}
bundle: income-distribution
variant: distribution
{}
```

A few countries compared, with a poverty line already drawn at $8.30 a day:

```archie
{.bespoke-component}
bundle: income-distribution
variant: distribution
{.config}
view: countries
countries: India, Brazil, Germany, userLocation
povertyLine: 8.3
{}
{}
```

Monthly incomes in the user's own currency:

```archie
{.bespoke-component}
bundle: income-distribution
variant: distribution
{.config}
currency: userLocation
timeInterval: monthly
{}
{}
```

## Notes

- `povertyLine` is always in international-$ per day, whatever `currency` and `timeInterval` say; the chart converts it.
- Countries in `countries` that the data doesn't have are left out silently. `userLocation` is left out when the user's country can't be detected.
- A custom `title` or `subtitle` hides the controls, as `hideControls` does.
