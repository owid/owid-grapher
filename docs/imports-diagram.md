# TypeScript Project References and Import Structure

This document shows the TypeScript project reference structure based on the tsconfig.json files throughout the codebase.

## Project Structure Diagram

```mermaid
graph TD;
    types["packages/@ourworldindata/types"];
    utils["packages/@ourworldindata/utils"];
    components["packages/@ourworldindata/components"];
    core_table["packages/@ourworldindata/core-table"];
    grapher["packages/@ourworldindata/grapher"];
    explorer["packages/@ourworldindata/explorer"];

    settings["settings"];
    serverUtils["serverUtils"];

    db["db"];

    adminShared["adminShared"];
    adminSiteServer["adminSiteServer"];
    adminSiteClient["adminSiteClient"];
    baker["baker"];
    site["site"];
    explorerAdminServer["explorerAdminServer"];

    jobQueue["jobQueue"];
    worker["devTools/worker"];
    cf_functions["functions"];

    utils --> types;

    serverUtils --> types;
    serverUtils --> utils;
    serverUtils --> settings;

    settings --> utils;

    db --> components;
    db --> explorer;
    db --> grapher;
    db --> types;
    db --> utils;
    db --> serverUtils;
    db --> settings;
    db --> site;

    adminSiteServer --> explorer;
    adminSiteServer --> grapher;
    adminSiteServer --> types;
    adminSiteServer --> utils;
    adminSiteServer --> adminShared;
    adminSiteServer --> adminSiteClient;
    adminSiteServer --> baker;
    adminSiteServer --> db;
    adminSiteServer --> explorerAdminServer;
    adminSiteServer --> serverUtils;
    adminSiteServer --> settings;
    adminSiteServer --> site;

    baker --> components;
    baker --> core_table;
    baker --> explorer;
    baker --> grapher;
    baker --> types;
    baker --> utils;
    baker --> db;
    baker --> explorerAdminServer;
    baker --> serverUtils;
    baker --> settings;
    baker --> site;

    jobQueue --> types;
    jobQueue --> utils;
    jobQueue --> db;
    jobQueue --> serverUtils;
    jobQueue --> baker;

    worker --> types;
    worker --> utils;
    worker --> db;
    worker --> jobQueue;
    worker --> serverUtils;

    classDef packageLayer fill:#e1f5fe;
    classDef infraLayer fill:#f3e5f5;
    classDef coreLayer fill:#e8f5e8;
    classDef appLayer fill:#fff3e0;
    classDef toolLayer fill:#fce4ec;

    class types,utils,components,core_table,grapher,explorer packageLayer;
    class settings,serverUtils infraLayer;
    class db,jobQueue coreLayer;
    class adminShared,adminSiteServer,adminSiteClient,baker,site,explorerAdminServer appLayer;
    class worker,cf_functions toolLayer;
```

## Key Observations

### Circular Import Issues

The current structure shows several problematic patterns:

1. **devTools/worker → adminSiteServer**: The worker imports from adminSiteServer for R2 helpers and route utils
2. **devTools/worker → db**: Worker imports from db models
3. **db → [many modules]**: DB has many outbound references but should be more foundational
4. **adminSiteServer → [many modules]**: AdminSiteServer imports from many places including baker

### Recent Improvements

The circular import issues have been resolved through refactoring:

1. **R2 helpers moved**: `adminSiteServer/R2/*` helpers moved to `serverUtils/r2/*`
2. **Job queue extracted**: Created dedicated `jobQueue` module for job processing logic
3. **Worker separation**: `devTools/worker` now imports from `jobQueue` instead of mixing concerns
4. **Dependency inversion**: Worker calls job processor instead of db models calling worker functions

### Current Architecture

The current structure follows a cleaner dependency hierarchy:

1. **Foundation**: `types` → `utils` → `settings` → `serverUtils`
2. **Core**: `db` + `jobQueue` (depends only on foundation + packages)
3. **Applications**: `adminSiteServer`, `baker`, etc. (can depend on core + foundation)
4. **Tools**: `devTools/*` (can depend on applications and core but shouldn't be imported by core)

## Remaining Structure Issues

- **db**: Still depends on `site`, `components`, `explorer` - these should depend on db instead
- **adminSiteServer**: Has very broad dependencies - consider splitting into smaller modules

## Recent Completed Refactoring ✅

1. ✅ **Moved shared utilities**: R2 helpers moved from `adminSiteServer/R2/` to `serverUtils/r2/`
2. ✅ **Extracted job queue**: Created dedicated `jobQueue` module for processing logic
3. ✅ **Fixed circular imports**: Worker now uses dependency injection pattern instead of being imported by db models
4. ✅ **Cleaner separation**: Each module now has clearer responsibilities and dependencies
