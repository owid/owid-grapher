# Shared search layer

Search is served from two places: the site's search page runs Algolia queries
from the browser, and `/api/search` answers them from a Cloudflare function.
Neither can import the other — one needs React, the other the Workers
runtime — so anything they must agree on lives here.

## The contract

**The same query returns the same results, whichever surface asks.** A reader
searching "gdp" on the site and a consumer calling `/api/search?q=gdp` are
asking one question, and two answers would mean one of them is wrong.

"The same" covers **relevance**: which records match, in which order, and what
happens when nothing does. It does not cover delivery — response shape,
pagination, sectioning and caching differ by design, because the two surfaces
have different jobs. The search page blends five result types into one laid-out
page; the API answers one query with one list.

**Relevance is not part of the API's stability contract.** The request and
response shapes are what `/api/search` promises its consumers; the ranking
behind them is tuned as the search page is tuned, and both move together. A
relevance change is not a breaking API change. Without this, every experiment
on the site's ordering would be gated on the public API — and identity would
quietly be abandoned instead.

## What belongs here

Code that decides **what to ask Algolia and how to read the answer**, with no
dependency on a runtime:

- query and filter construction
- what a filter value denotes, as distinct from whether it is well-formed
- ranking and result ordering
- fallback policy — what happens on an empty result set
- wire formats the two sides must both understand
- presentation of a single hit, where both sides render the same thing

What does not belong here: React Query hooks, `SearchState` and its URL
synchronisation, HTTP request parsing and the validation of untrusted input
(whether a value is well-formed is a property of how it arrived, and only the
API takes input it doesn't control), `Env` and secrets, Sentry, and the API's
public response envelope. Those are each one surface's own business.

The two halves of that split meet on the same parameter more often than it
sounds: rejecting an unknown `pageTypes` value belongs to the API, while
deciding that a topic page request covers both of its gdoc subtypes is a claim
about the search domain, and belongs here.

## What both sides inherit

The index configuration in `baker/algolia/configureAlgolia.ts` sits upstream of
everything here: `attributesForFaceting` decides what can be filtered at all,
`searchableAttributes` and the ranking settings decide what matches. Editing it
moves both surfaces at once without either being touched, and some of what looks
arbitrary in this directory is that config showing through — topic pages are
looked up by `path` rather than `slug`, for instance, because only `path` is
declared filterable, and because slugs are not unique across gdoc types.

## Consumers

The two that answer queries, and so owe each other the contract above:

- `site/search/queries.ts` — the search page's Algolia queries
- `functions/api/search/searchApi.ts` — the public `/api/search` endpoint

Two more depend on this layer without being query surfaces of their own:

- `functions/api/search/cached-queries.ts` — proxies the site's empty-query
  "browse" requests, and recognises them by the shared payload test
- `functions/_common/search/` — builds a chart hit card's rich data, served
  from the grapher route and laid out by the same helpers the search UI uses,
  so both ends place the grapher tabs identically

See also `site/search/README.md` for the search page's own architecture, and
`docs/search-api.openapi.yaml` for the API's contract.
