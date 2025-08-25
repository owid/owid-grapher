# Bash commands

- yarn typecheck: runs the typescript typechecker across all files
- yarn testLintChanged: run eslint on changed files
- yarn testPrettierChanged: run prettier on changed files
- yarn fixPrettierChanged: attempt to fix prettier issues on changed files
- yarn test run --reporter dot: run unit tests. Uses vitest, can take one or more test filenames to only run a subset.
- make migrate: apply migrations
- make dbtest: run database and api tests

When you have completed implementing a set of changes, ALWAYS run `yarn typecheck` and fix any errors you have.

When you want to create a git commit, refer to docs/agent-guidelines/commit-messages.md for instructions.

## Code style

- We use double quotes for string literals instead of single quotes
- Use type definitions for function params and return values. Reuse existing shared type definitions where possible.
- Avoid the use of the `any` type. Only use it if you have to and ask for permission.
- In Grapher and the admin, where we use MobX 6, we use a somewhat nonstandard setup. We use class based components with TC-39 stage 3 decorators, but only for @computed and @action properties. The observable props are not marked with @observable, but are instead listed in the constructor in a `makeObservable` call. The `makeObservable` call must mention all obserable props, but none of the @computed or @action ones.

# Codebase overview

This is a sort of monorepo for the Our World In Data website, including our custom data viz react component, Grapher. The codebase is in typescript, uses React 19 and Node 22.

Some key directories, going roughly along the dependency chain from the most standalone pieces to the one with the most dependencies:

- ./packages/types - shared type definitions
- ./packages/utils - utility functions
- ./packages/core-table - our custom dataframe classes used by Grapher
- ./packages/components - shared React components
- ./packages/grapher - our data viz component. Written using MobX 6 for state management
- ./packages/explorer - our data explorer that wraps grapher and adds additional drop-downs to explore more complex datasets
- ./db - code to access our MySQL 8 database as well as a substantial amount of business logic around reading ArchieML written in Google Docs
- ./site - code for our website (React rendering ArchieML). This part of the codebase does not use MobX but instead uses React hooks
- ./baker - code that "bakes" our website by rendering React to static HTML
- ./adminSiteServer - internal API for our admin
- ./adminSiteClient - client UI of the admin
- ./devTools - various utilities
- ./functions - CloudFlare Functions. Most of our website is static but all our charts under https://ourworldindata.org/grapher/* are behind CF functions. These handle dynamic thumbnail generation, data downloads for end users etc.

# Database documentation

Our main datastore is a mysql 8 database. The documentation for this lives in db/docs - there is README.md file which is a good overview and starting point, then one TABLE-NAME.yml file per table describing the table in more detail. ALWAYS list the directory db/docs/ to understand which tables are available and read the relevant table description files before constructing a query or writing a migration.

You can run (read only) queries against the database with `yarn query "QUERY TEXT"` - e.g. if you need to understand the contents of a table of the cardinality of various tables.
