A blue-background section with a chart icon and title, wrapping any
Gdoc content. Used on linear topic pages to group the
"explore the data" charts/explorers.

```archie
{.explore-data-section}
title: Explore the data
[.+content]
[.+guided-chart]
{ .sticky-right }
[.+right]
{.chart}
url: https://ourworldindata.org/grapher/religious-composition
size: wide
{}
[]
[.+left]
{.heading}
text: Global data on religious affiliation from Pew Research Center
level: 2
{}
This page features a range of data on religious affiliation: the share of people who are religious, what religion they belong to, and how these patterns have been changing over time.
This is based on self-identification: what people <i>say</i> about their religious affiliation.
In this chart, you can explore this data in more granular detail for each country.
Here are a few insights from these key indicators:
[.list]
* Levels of religiosity <a href="#guide:https://ourworldindata.org/grapher/religious-composition?tab=discrete-bar&time=2020&country=OWID_WRL%7EIND%7EIDN%7EGBR%7EUSA%7ECHN%7EJPN%7EKOR%7EVNM%7ECZE&religion=any_religion&indicator=share" class="guided-chart-link">can vary from</a> as high as almost 100% in some countries (such as India) and as low as 10% in others (such as China). You can add and remove other countries to compare.
* The share of people who are religious <a href="#guide:https://ourworldindata.org/grapher/religious-composition?tab=slope&time=earliest..2020&country=USA%7EGBR%7ENOR%7EFRA%7EAUS%7ECAN&religion=any_religion&indicator=share" class="guided-chart-link">has declined substantially</a> in many countries between 2010 and 2020, including the United States, Canada, Australia, and much of Europe.
* The geographical distribution of particular religions varies a lot. Christianity <a href="#guide:https://ourworldindata.org/grapher/religious-composition?tab=map&religion=christians&indicator=share" class="guided-chart-link">is very widespread</a>, with high population shares across Europe, North and South America, and much of Africa. Islam is more concentrated, but still <a href="#guide:https://ourworldindata.org/grapher/religious-composition?tab=map&religion=muslims&indicator=share" class="guided-chart-link">has high shares</a> across multiple regions, including North Africa, the Middle East, and Southeast Asia. Religions such as Hinduism and Buddhism are very geographically concentrated; <a href="#guide:https://ourworldindata.org/grapher/religious-composition?tab=map&religion=hindus&indicator=share" class="guided-chart-link">Hinduism in South Asia</a> and <a href="#guide:https://ourworldindata.org/grapher/religious-composition?tab=map&religion=buddhists&indicator=share" class="guided-chart-link">Buddhism in South-East and East Asia</a>.
* Rates and absolute numbers can give a very different perspective. While <a href="#guide:https://ourworldindata.org/grapher/religious-composition?tab=discrete-bar&time=latest&country=IND%7EIDN%7EPAK%7EBGD%7ENGA%7EEGY%7EIRN%7ETUR&religion=muslims&indicator=share" class="guided-chart-link">just 15% of people</a> in India identify as Muslim, compared to 97% in its neighbor, Pakistan, it has <a href="#guide:https://ourworldindata.org/grapher/religious-composition?tab=discrete-bar&time=latest&country=IND%7EIDN%7EPAK%7EBGD%7ENGA%7EEGY%7EIRN%7ETUR&religion=muslims&indicator=count_unrounded" class="guided-chart-link">almost the same number</a> of Muslims in total.
[]
[]
{}
[]
[]
{}
```

## When to use

- On linear topic pages to introduce the charts-and-data portion of
  the page.

## When NOT to use

- On regular topic pages or articles.

## Notes

When `title` is omitted, "Explore the data" is shown.
