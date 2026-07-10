The introduction section of a topic page. Renders the topic title,
optional download button, optional related-topics chips, and an intro
body of rich text.

```archie
{.topic-page-intro}
[.+content]
The world <a href="https://docs.google.com/document/d/14ZnX7uW1aOuJAM7CPFmxwdq8fniYwBqDfbp4mlS0ZZA/edit">lacks</a> a safe, low-carbon, and cheap large-scale energy infrastructure.
Until we scale up such an energy infrastructure, the world will continue to face two energy problems: hundreds of millions of people lack access to sufficient energy, and the dominance of fossil fuels in our energy system drives <a href="https://ourworldindata.org/co2-and-greenhouse-gas-emissions">climate change</a> and other health impacts such as <a href="https://ourworldindata.org/air-pollution">air pollution</a>.
To ensure everyone has access to clean and safe energy, we need to understand energy consumption and its impacts around the world today and how this has changed over time.
On this page, you can find all our data, visualizations, and writing relating to energy.
[]
{.download-button}
text: Download all data on energy
url: https://github.com/owid/energy-data
{}
[.related-topics]
url: https://ourworldindata.org/co2-and-other-greenhouse-gas-emissions
text: CO₂ and Greenhouse Gas Emissions
url: https://ourworldindata.org/air-pollution
text: Air Pollution
url: https://ourworldindata.org/oil-spills
text: Oil Spills
[]
{}
```

```archie
{.topic-page-intro}
[.+content]
Disease outbreaks may be inevitable, but large-scale pandemics are not. The world can respond swiftly and effectively to pandemic risks in the future with better understanding, resources, and effort.
To avoid suffering through another large pandemic, we have to take the risk of pandemics seriously. Despite warnings that another one was likely, the COVID-19 pandemic killed more than 27 million people.1
We must build the capacity to test for pathogens and understand them: which pathogens put us at the greatest risk, how they spread, and how to tackle them.
We know it is possible to greatly reduce the risk of infectious disease. We’ve learned over history how to reduce their impact with vaccines, public health efforts, and medicine.
In addition to the old risks, we face new threats from factory farming, genetic modification, climate change, and antimicrobial resistance. With more attention and effort, we can reduce their risks too.
On this page, we show data and research on pandemics in history and how we can reduce their risk in the future.
[]
{}
```

## When to use

- Included on every topic page (`type: topic-page`) as the first block
  of the body.

## When NOT to use

- On non-topic-page documents (articles, data insights, linear topic
  pages, homepage, etc.).

## Notes

Omit the download button when there is no canonical dataset to offer.
`related-topics` entries can be gdoc links (metadata resolves
automatically) or external URLs (supply `text`).
