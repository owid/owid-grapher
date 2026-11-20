---
title: Getting a featured viz into search
category: Publishing
---

A featured-viz page can show as a card at the top of the Data results in
site search. It shows for the exact searches you pin it to, and when a
reader picks one of its topics without typing anything. Getting a
`{template:featured-viz}` page there takes four steps.

## 1. Make the page

Write the page as a `{template:featured-viz}` gdoc, with the viz as the
first `{.bespoke-component}` block in the body. Search builds the card from
the front matter, so fill in `title`, `authors`, `excerpt` and
`featured-image`.

Open the page's preview in the admin (see
`{guide:previewing-and-publishing}`) and click the settings icon. Until the
page has pins, the panel warns "No pinned searches are set" and gives you a
line to copy.

## 2. Ask Claude for pins

Paste that line into Claude Code:

`/suggest-pinned-searches https://docs.google.com/document/d/<GDOC_ID>/edit`

Claude reads every search typed on the site at least 1,000 times in the last
12 months. It marks each one that fits your page "yes", "maybe" or "no",
with a one-line reason and the number of searches. It also flags searches
already pinned to another published page. Claude only suggests. Keep the
searches you agree with and drop the rest.

The command needs the Metabase connector in Claude Code. If it's missing,
Claude says so and stops.

## 3. Paste the pins into the gdoc

Add one line to the front matter, with the searches separated by commas:

`pinned-for-searches: migration, immigration`

Case and punctuation don't matter, so a pin on `co2 emissions` also matches
a reader typing "CO2 Emissions". A pin has to match the reader's whole
search, though. `migration` doesn't match "migration to europe".

## 4. Publish

Publish (or republish) the page from the admin. It goes into the search
index right away. Search for one of your pins on the site, and the card
shows at the top of the Data results. Autocomplete suggests the page too.

## Side quest: tag a topic

In the admin's [Google Docs list](https://admin.owid.io/admin/gdocs), use "Edit tags" on the page's row to give
it a topic. When a reader picks that topic and types nothing, the most-viewed
featured viz with that tag shows as the card, even without pins. The site
caches topic results for up to a day, so a new or changed tag can take that
long to show.

## Side quest: find rarer searches

Claude only looks at searches typed at least 1,000 times a year. To see
rarer ones, open the Metabase question
[Top site searches, last 12 months](http://metabase.owid.io/question/2017)
and lower "Min Searches".

## Side quest: when a pin is already taken

One search can show only one featured viz. If another published page
already has one of your pins, the admin blocks publishing and names that
page in the error. Drop the pin from one of the two pages, then publish again.

## Notes

A page with no pins and no topic tag never shows in search. A page with a
topic tag but no pins only shows when a reader browses that topic.

Search uses hand-picked pins rather than matching the page's text. The
[search replay report](http://vibe.owid.io/reports/featured-viz-search-replay/)
tested text matching on real site searches. Matching on the whole page
showed wrong cards too often, and matching on fewer fields lost good ones.
