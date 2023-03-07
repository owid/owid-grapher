Vite

-   [x] Fix up client settings
-   [x] Use "more dynamic" preview server url/port
-   [x] `yarn vite preview` doesn't work, because asset names are different
-   [x] Admin doesn't work
-   [x] Chunk naming: `faBook`
-   [ ] `embedCharts` snippet
-   [x] Get rid of webpack & maybe Storybook
-   [ ] Ensure that changes in monorepo packages are picked up "almost live"
-   This might entail switching to semi-ESM, since [vite does not pick up changes to cjs packages](https://vitejs.dev/guide/dep-pre-bundling.html#monorepos-and-linked-dependencies)
