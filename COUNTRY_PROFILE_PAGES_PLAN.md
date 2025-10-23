# Country Profile Pages Migration Plan

This document outlines the plan to migrate from the old country profile system (See e.g. `baker/countryProfiles.tsx`, `site/CountryIndexPage.tsx`) to a new Google Docs-based system using a new `GdocProfile` model. (See `db/model/Gdoc/GdocDataInsight.ts`)

These pages are templated, mass-produced overviews of a country's data on a given topic.

So we have e.g. /country/co2/spain and /country/co2/china etc

and also /country/energy/spain and /country/energy/china

Energy and CO2 are the only legacy profiles that we have, but with this new system we'd like to be able to create more.

Once we have the code infrastructure to make these new pages, I'll manually create the source data in Google Docs - there's no need to programatically migrate the old data.

## Overview

The new system will be based around templates written in ArchieML in Google Docs.

The archie will look something like

```
type: profile
scope: countries
title: $entityName Energy Profile

[.+body]
{.heading}
text: How much energy does $entityName consume annually?
level: 2
{}
{.chart}
url: https://ourworldindata.org/grapher/energy-consumption?countries=$entityCode~JPN~NLD
{}

This chart shows the energy consumption for $entityName.
[]
```

scope is set of enums: "countries", "regions", particular entities e.g. "North America", or "all"

$entityName and $entityCode will be special string literals that we replace with e.g. "Spain" and "ESP" during baking

Our archieToEnriched pipeline will convert this to the following JSON:

```
{
  "body": [
    {
      "type": "heading",
      "text": [
        {
          "text": "How much energy does $entityName consume annually?",
          "spanType": "span-simple-text"
        }
      ],
      "parseErrors": []
    },
    {
        "type": "chart",
        "url": "https://ourworldindata.org/grapher/energy-consumption?countries=$entityCode~JPN~NLD"
    }
  ],
  "refs": {},
  "type": "profile",
  "scope": "countries",
  "title": "$entityName Energy Profile",
  "authors": ["Hannah Ritchie"],
  "excerpt": "Information on the energy usage of $entityName.",
  "subtitle": "Information on the energy usage of $entityName.",
  "featured-image": "energy-thumbnail.png"
}

```

The old pages are baked at e.g. /co2/country/spain - we want the new pages to be baked at /profile/co2/spain

- This feature is being developed on a dedicated branch, so we can safely remove the legacy country profile implementation as part of the initial cleanup without affecting production.

- This will be set in the GdocsSlug setting (not written in archie, but instead stored directly on the enriched model that we store in the DB)
- For profiles, we'll need some sort of special handling to ensure that if the slug is set as "co2" we bake each profile at /profile/co2/$entityName.html
- The admin UI already exposes this `slug` field in `adminSiteClient/GdocsSettingsForms.tsx`, so authors will manage the active portion of the path (e.g. "energy") from there.

We have a regions.json that contains all the country and region data and a regions.ts file (exported via @ourworldindata/utils) for working with them.

Here are the steps for this project, as I see them.

- [x] Delete all existing countryProfile code (not CountryIndex code)
- [x] Create a new OwidGdocProfileInterface
- [x] Create a new GdocProfile class that extends the GdocBase class and implements OwidGdocProfileInterface and implements the necessary boilerplate (as defined in each one of these Document-type classes, plus profile-specific code such as validation for the "scope" front-matter attribute)
- [ ] Create an object that augments regions.ts which knows whether or not an entity needs an article before it (e.g. regions.json has { "name": "United States" } and we need to know that that should be inserted as "the United States" ) and create a function called articulateEntity which will add this prefix if necessary when we replace $entityName in the template. The plan is to add an `article` property directly on each entity in `regions.json` so both client and baker share the same canonical metadata.
- [ ] Create a function that takes the enriched JSON representation of a template and replaces all the $entityName and $entityCode instances with a given entity. Templates will only use `$entityCode` inside URLs, so we can rely on simple string replacement without additional URL encoding.
- [ ] Create a function called renderProfileForEntity which takes a GdocProfile and a given entity (e.g. "Spain") which would be able to render the page (defined later)
- [ ] Create a site/gdocs/pages/Profile.tsx component that will receive a processed version of this data model and render it (similar to site/gdocs/pages/Post.tsx)
- [ ] Add a path to site/gdocs/OwidGdoc.tsx to render the page
- [ ] Support this route in mockSiteRouter.ts at the route `/profile/:slug/:entity`
- [ ] Create a new settings drawer (see e.g. GdocPostSettings) which would give the author a way to preview the profile for a different country
- [ ] Include country profiles in the sitemap. Each template will expand to ~200 entity-specific URLs, so we should keep an eye on sitemap generation performance.
- [ ] Reimplement a new version of the `countryProfiles` baking step in SiteBaker.tsx (using renderProfileForEntity)
- [ ] Add redirects from the old URL to the new one

Although we will launch with country-only scope, the infrastructure should make it easy to add region-level profiles later (e.g. "Asia"), since the entity metadata already lives in `regions.json`.
