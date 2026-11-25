# Analytics events

The site sends custom events to Google Analytics 4 (GA4): a chart scrolled into
view, a click on a download button, a search, and so on. This page says how an
event gets from the visitor's browser to a row in GA4, and where each event is
described.

## Where events are described

One file is the source of truth:
[`analyticsTypes.ts`](../packages/@ourworldindata/types/src/analyticsTypes/analyticsTypes.ts).
Nothing else needs reading to interpret an event.

- **`EventCategory`** lists the name of every event, e.g. `owid.grapher_click`.
- **`EventParamsMap`** pairs each event with its params type, e.g.
  `GrapherClickParams`.
- **The params type** holds everything about the event. Its doc comment says
  what the event is and when it fires. `@since YYYY-MM` is the month from
  which rows with this name exist, so the absence of earlier rows means "not
  tracked under this name yet", not "nobody did this". Its fields are the parameters sent with the event.
- **`eventAction`**, on the events that have one, is typed as the list of
  every value it can take. For clicks that list is `TrackNote`: every value of
  the `data-track-note` HTML attribute, which marks an element as tracked.
  The one exception is clicks on explorer controls: their value is the
  explorer's slug, `_click_`, then the control's title, so `TrackNote`
  describes them with a pattern instead of listing them.

GA4 cuts every text parameter at 100 characters.

## How an event reaches GA4

1. **The page calls `logToGA`** (`GrapherAnalytics.ts`, extended by
   `site/SiteAnalytics.ts`), through one of the `log…` methods. It pushes the
   event, with its name in the `event` field, onto `window.dataLayer`. Clicks
   on elements with a `data-track-note` attribute are picked up by a single
   listener (`startClickTracking`).
2. **Google Tag Manager (GTM) reads the data layer** and forwards the event to
   GA4. GTM only forwards the parameters its container is set up to forward.
   That setup, including the name each parameter gets in GA4, lives in the GTM
   UI, not in this repository. Consent is handled there too.
3. **GA4 stores the event** as one row in its raw events table.

Pages only have GTM when they were baked with `GOOGLE_TAG_MANAGER_ID` set, which
is the case in production and not on staging. See
[google-tag-manager.md](google-tag-manager.md) for the details of GTM, the data
layer, and how to debug on a staging server.

## Adding an event or a parameter

Add the event to `EventCategory` and `EventParamsMap`, and give its params type
a description and a `@since` tag.

**Register every new parameter in Google Tag Manager.** A parameter that is not
registered in the
[GTM container](https://tagmanager.google.com/#/container/accounts/4702630479/containers/12712743/workspaces/50/tags)
is not collected by GA4, even though the page sends it.

## Changing or removing an event

- When you change what an event sends or where it fires, add a dated `@change`
  line to its params type in the same PR.
- When you remove an event, retire it, don't delete it: rows sent in the past
  still need explaining.
