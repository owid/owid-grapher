---
name: suggest-pinned-searches
description: >-
    Suggest the pinned-for-searches values for a featured-viz gdoc from the
    most-searched queries of the last 12 months, and flag searches already
    pinned to another published featured viz. Use when an author asks which
    searches a featured-viz page should be pinned for, wants to fill or
    review its pinned-for-searches field, or to review every featured viz's
    pins at once.
metadata:
    internal: true
---

# Suggest pinned searches for a featured viz

A featured-viz page shows as a card at the top of the Data search results only when the reader's whole search, normalized, equals one of the page's `pinned-for-searches` values (rules: `packages/@ourworldindata/types/src/gdocTypes/templates/OwidGdocFeaturedVizContent.md`). The suggested list is the whole list: candidates are only the searches in step 2's results, exactly as written there.

## Inputs

- The page: a slug, a gdoc id or a docs.google.com URL. Ask if none was given.
- Mode: one page (default) or every featured viz (run step 2 once, judge each search against all pages in one pass, and give each page its own table).

## Data access

Use the **Metabase MCP connector** (find its tools with ToolSearch, query `metabase`) and its `execute` tool. If the connector is missing or `execute` fails, stop and tell the user to connect Metabase with an API key that can run queries on database 3. Use no other credentials.

## Steps

### 1. Read the page and every other featured viz

Run in SQL mode against database id 3 (`posts_gdocs` here is a daily mirror of production; `content` is a JSON string):

```sql
SELECT id, slug, published,
       JSON_VALUE(content, '$.title') AS title,
       JSON_VALUE(content, '$.subtitle') AS subtitle,
       JSON_VALUE(content, '$.excerpt') AS excerpt,
       JSON_QUERY(content, '$."pinned-for-searches"') AS pins,
       ARRAY_TO_STRING(REGEXP_EXTRACT_ALL(JSON_QUERY(content, '$.body'), r'"text":"((?:[^"\\]|\\.)*)"'), ' ') AS body_text
FROM `owid-analytics.prod_mysql.posts_gdocs`
WHERE type = 'featured-viz'
ORDER BY published DESC, updatedAt DESC
```

Find the target row by slug, id or title (drafts have an empty slug). Keep the other rows: their titles and excerpts tell you which searches belong to another page, and the published ones' `pins` are the clash list. The target page's own `pins` are what it's pinned for now; when there are any, steps 3 and 5 review them. The mirror lags production by up to a day; if the author just published a page with pins, ask them to confirm.

### 2. Pull the most-searched queries

Run the Metabase question [Top site searches, last 12 months](http://metabase.owid.io/question/2017) once, in card mode with `row_limit` 500 (each run scans about 12 GB):

```json
{
    "card_id": 2017,
    "card_parameters": [
        {
            "id": "10e50bb4-c0ef-4a54-96e6-c1c8b6f5b840",
            "slug": "min_searches",
            "type": "number/=",
            "target": ["variable", ["template-tag", "min_searches"]],
            "value": 1000
        }
    ]
}
```

The card is the one copy of the query: run it as is and keep its SQL out of this skill. If it's gone or its columns changed, stop and tell the user.

Each row is a search already cleaned the way the site matches pins, with its count in `searches_12m`. The other columns aren't used.

Keep `min_searches` at 1,000, even when a page gets no pins. That's a search typed a few times a day, the least a pin is worth; it's also about the highest bar that still keeps every featured viz's obvious head search.

### 3. Judge each search

Go through the whole list. Most searches get no featured viz, and that's the expected outcome. Drop the unrelated ones silently. For each of the rest, ask: if a reader typed exactly this, would this viz be a useful thing to show them first? If another featured viz (step 1) fits it better, it goes to that page, not this one.

- **yes**: the search is about what the page covers, and readers typing it would find the viz useful, even if some wanted something else. A niche page may get only one or two, or none.
- **maybe**: real overlap but a weaker fit, for example a measure the viz uses as an input but doesn't centre on. Say what would make it a yes.
- **no**:
    - a broad or adjacent topic where the viz would miss what most readers want;
    - a search that better fits another featured viz, published or draft, since each search can go to only one page;
    - country- or year-specific searches (`europe population`, `population 2023`), unless the year is one the viz is about, such as a projection horizon.

Judge each of the page's current pins the same way. A current pin missing from step 2's results gets fewer than 1,000 searches a year; it's a no.

### 4. Check clashes

For each yes or maybe search, check whether another **published** featured viz already has it in its `pins` (both sides are normalized, so compare exact strings). The admin refuses to publish a page whose pins clash, so a clashing search can only stay if the other page drops it. Name the other page's slug. Pins on drafts aren't blocking yet; mention them as "also in draft SLUG".

### 5. Hand back

Print one table, ranked by volume, with every yes and maybe, every current pin, and the no rows that were close calls. If a page gets no yes rows, say so: its topic isn't searched often enough to earn a pin.

| Search | 12-month searches | Now | Suggest | Why | Clash |
| ------ | ----------------- | --- | ------- | --- | ----- |

- Now: `pinned` for a current pin, blank otherwise. A pinned search that's now a no is a drop; a yes that isn't pinned is an add.
- 12-month searches: `under 1,000` for a current pin missing from step 2's results.
- Why: one short line.

Then the line to paste into the doc's front matter: the full new list, with the yes searches in volume order (add maybe searches only if the author agrees). When the page already has pins, it replaces the old line, and say which pins it adds and drops.

```
pinned-for-searches: population, world population, total population
```

The author pastes it into the Google Doc's front matter and publishes (or republishes) from the admin, where the clash check runs.

End with a link to the Metabase question, [Top site searches, last 12 months](http://metabase.owid.io/question/2017), for authors who want to explore further: they can lower `min_searches` there to see rarer searches.

## Related skills

- `add-synonym`: makes broader wordings find the same results. Pins are exact-match only, so use synonyms when a page should match a wording family rather than a short list.
