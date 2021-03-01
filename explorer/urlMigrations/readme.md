# Explorer URL migrations

URLs contain technical debt we can never get rid of.

The goals of this module are to:

1. **Keep legacy Explorer URL migrations in one place**, so that we can more easily see and compare the flows of each migration.
2. **Keep Explorer URL migrations simple**, so that we don't need to understand the details – just run one function on your URL and it's up to date.

There's a mix of cases where we need to migrate URLs:

-   User visits old path with old URL params (e.g. legacy COVID explorer)
-   User visits new path with old URL params (e.g. old CO2 & Energy explorers)
-   Authors embed Grapher that is redirected to an Explorer view (we do this for old COVID charts)
-   Authors embed Explorer that has old URL params (since URLs are in the Wordpress database, we cannot easily replace all. Even if we do, it isn't robust – authors occasionally use the revert option.)

(Also note that embeds are iframeless – if they were `<iframe>` it would be simpler.)

## How are Explorer URLs migrated?

In order:

1. **Apply Explorer redirects** `(Url, baseQueryStr) → Url` ([`ExplorerRedirects.ts`](../../explorerAdmin/ExplorerRedirects.ts))

    This is done **server-side** for Grapher → Explorer redirects and LegacyCovidExplorer → GridCovidExplorer.

    Because each Grapher redirects to a different Explorer configuration, there is a `baseQueryStr` baked into `ExplorerPage` and used as a parameter in the redirect.

    The redirect is done client-side with `window.history.replaceState()`, based on the **baked specification** ([`ExplorerPageUrlMigrationSpec.ts`](./ExplorerPageUrlMigrationSpec.ts)).

2. **Apply Explorer migrations** `(Url) → Url` ([`ExplorerUrlMigrations.ts`](./ExplorerUrlMigrations.ts))

    This is how we handle Explorer query param changes on **client-side** (e.g. in the old CO2 and Energy explorers).

    Because the old & new Explorers are on the same path, we can't bake a redirect spec – the URL migration logic has to be fully in the client-side bundle.

## Regrets

This could've been simpler if all redirects were done client-side, without baking redirect specifications on `ExplorerPage`. One downside is that the redirect `baseQueryStr` would need to be in the client-side bundle.
