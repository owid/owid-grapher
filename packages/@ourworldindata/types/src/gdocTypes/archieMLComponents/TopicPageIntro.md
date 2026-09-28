The introduction section of a topic page. Renders the topic title,
optional download button, optional related-topics chips, and an intro
body of rich text.

```archie
{.topic-page-intro}
[.+content]
Population growth is one of the most important topics we cover on Our World in Data.
For most of human history, the global population was a tiny fraction of what it is today. Over the last few centuries, the human population has gone through an extraordinary change. In 1800, there were one billion people. Today there are more than 8 billion of us.
But after a period of very fast population growth, demographers expect the world population to peak by the end of this century.
On this page, you will find all of our data, charts, and writing on changes in population growth. This includes how populations are distributed worldwide, how this has changed, and what demographers expect for the future.
[]
[.related-topics]
text: Child Mortality
url: https://ourworldindata.org/child-mortality
text: Fertility Rate
url: https://ourworldindata.org/fertility-rate
text: Life Expectancy
url: https://ourworldindata.org/life-expectancy
text: Age Structure
url: https://ourworldindata.org/age-structure
[]
{}
```

## When to use

- Included on every topic page (`type: topic-page`) as the first block
  of the body.

## When NOT to use

- On non-topic-page documents (articles, data insights, linear topic
  pages, homepage, etc.).

## Properties

- `downloadButton`: A button in the right-hand column linking to the
  topic's canonical dataset, authored as a nested `{.download-button}`
  with a `text:` label and a `url:` line — both are required, and a
  button missing either drops the whole block with a parse error. Omit
  the section entirely when there is no canonical dataset to offer.
- `relatedTopics`: The "Related topics" chips in the right-hand column,
  authored as a `[.related-topics]` section of repeated `url:` (+
  optional `text:`) entries. Each entry needs a `url` — a gdoc link
  resolves its own title automatically, while an external URL must also
  supply `text`; violating either rule drops the whole block with a
  parse error. Omitted, no chips are shown.
- `content`: The intro paragraphs, authored as `[.+content]` rich text
  (formatting and links survive). Only plain paragraphs are allowed —
  anything else (lists, headings, …) is filtered out with a warning.
  Required; without it the block is dropped.
