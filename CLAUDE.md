# Bash commands

- yarn buildLerna: Build the packages (types and utils, core table, the grapher data viz component and the data explorer)
- yarn typecheckLerna: runs the typescript typechecker across all files (both frontend code in lerna managed packages and the rest of the site)
- yarn testLint: run eslint
- yarn test: run vitest
- yarn testPrettierAll: run prettier
- yarn fixPrettierAll: attempt to fix prettier issues

# Codebase overview

This is a sort of monorepo for the Our World In Data website, including our custom data viz react component, Grapher. The codebase is in typescript, uses React 17 and Node 22.

Some key directories, going roughly along the dependency chain from the most standalone pieces to the one with the most dependencies:

- ./packages/types - shared type definitions
- ./packages/utils - utility functions
- ./packages/core-table - our custom dataframe classes used by Grapher
- ./packages/components - shared React components
- ./packages/grapher - our data viz component. Written using MobX 5 for state management
- ./packages/explorer - our data explorer that wraps grapher and adds additional dropdowns to explore more complex datasets
- ./db - code to access our MySQL 8 database as well as a substantial amount of business logic around reading ArchieML written in Google Docs
- ./site - code for our website (React rendering ArchieML). This part of the codebase does not use MobX but instead uses React hooks
- ./baker - code that "bakes" our website by rendering React to static HTML
- ./adminSiteServer - internal API for our admin
- ./adminSiteClient - client UI of the admin
- ./devTools - various utilities
- ./functions - CloudFlare Functions. Most of our website is static but all our charts under https://ourworldindata.org/grapher/* are behind CF functions. These handle dynamic thumbnail generation, data downloads for end users etc.

# Database documentation

Our main datastore is a mysql 8 database. The documentation for this lives in db/docs - there is README.md file which is a good overview and starting point, then there is a yml file for each table.

You can run (read only) queries against the database with `yarn query "QUERY TEXT"` - e.g. if you need to understand the contents of a table of the cardinality of various tables.
