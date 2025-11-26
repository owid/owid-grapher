## Context

We recently added a new “announcement” content type which powers the “Updates and Announcements” section on the homepage and also appears as a new kind of post on the new `/latest` feed.

There are 2 kinds of announcement, currently:

1. Regular - a standalone post that can contain whatever.
    1. Clicking on it from the homepage takes you to the feed
    2. Often has a short body and then a CTA at the bottom
2. CTA - a short announcement that exists to link to a second resource.
    1. Clicking on it from the homepage takes you straight to the resource
    2. Unused so far

Our authors are updating linear topic pages with new sections, and we want a way to announce them.

Regular announcements don’t quite work because:

1. These sections might be very long, longer than we want to put in the feed
2. We want them to have a different title on the homepage vs. on the feed
3. We want the homepage link to take you directly to announcement’s standalone page

## Implementation plan

Add new parameters to the announcement front-matter:

1. `spotlight: true`
2. `homepage-title: New writing on trade`
3. `source-document: https://docs.google.com/document/d/some-id/edit`

When spotlight = true:

1. Homepage link takes you to the page
2. Feed link takes you to the page
3. Feed post is truncated in the data we render for the feed and the item is also height-limited via CSS (max-height 300px + overflow: hidden)
4. Add `<meta name="robots" content="noindex, follow" />` to the head of the announcement and set `<link rel="canonical">` to the `source-document`
5. Open Graph/Twitter meta should still reference the announcement URL for sharing previews, even if the canonical points to the source topic page

Validation

1.  homepage-title is required, if spotlight = true - will need to update gdocsValidation.ts
2.  spotlight cannot be true if it's a cta-style announcement
3.  source-document must exist, be published, and be a full URL without anchors/fragments

SEO and sitemap rules

1. Announcements are already excluded from sitemaps; keep spotlights excluded as well.
2. Dedicated announcement pages (spotlight and non-spotlight) should include `<meta name="robots" content="noindex, follow" />`; spotlights also set canonical to `source-document`, while non-spotlights can canonical to themselves.

TODO

- [ ] Add types for spotlight fields (`homepage-title`, `spotlight`, `source-document`)
- [ ] Implement validation in `gdocsValidation.ts` (requirements, CTA exclusion, URL checks)
- [ ] Update homepage latestAnnouncements behaviour for spotlights
- [ ] Update announcement page rendering for spotlights
- [ ] Update announcement feed rendering for spotlights
