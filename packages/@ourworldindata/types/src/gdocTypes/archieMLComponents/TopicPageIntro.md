The introduction section of a topic page. Renders the topic title,
optional download button, optional related-topics chips, and an intro
body of rich text.

## When to use
- Included on every topic page (`type: topic-page`) as the first block
  of the body.

## When NOT to use
- On non-topic-page documents (articles, data insights, linear topic
  pages, homepage, etc.).

## Variations
- `download-button` is optional — omit if there is no canonical
  dataset to offer for download.
- `related-topics` entries can be gdoc links (metadata resolves
  automatically) or external URLs (must supply `text`).

### Basic

```archie
{.topic-page-intro}
{.download-button}
text: Download all data on this topic
url: https://github.com/owid
{}

[.related-topics]
url: https://docs.google.com/document/d/1g_38g_DYBW8yhTJ2-heHJ4UFwBju41xlZGfirV7VZak/edit

url: https://ourworldindata.org/co2-and-other-greenhouse-gas-emissions
text: CO₂ and Greenhouse Gas Emissions
[]

[+.content]
Intro text for this topic page.
[]
{}
```

### Minimal (content only)

```archie
{.topic-page-intro}
[+.content]
A short introduction to the topic.
[]
{}
```
