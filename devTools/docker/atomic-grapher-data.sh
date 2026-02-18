#!/usr/bin/env bash
#
# Atomic database refresh script for grapher.
#
# IMPORTANT: This script requires the database user to have privileges to create
# and drop databases. Grant with:
#
#   GRANT ALL PRIVILEGES ON *.* TO 'owid'@'%';
#   FLUSH PRIVILEGES;
#
# Unlike refresh-grapher-data.sh which drops and recreates the database (killing
# all active connections), this script uses an atomic table swap approach:
#
# 1. Import fresh data into a temporary database (grapher_new)
# 2. Atomically swap all tables using RENAME TABLE:
#    - grapher.X -> grapher_old.X (move current tables out)
#    - grapher_new.X -> grapher.X (move new tables in)
# 3. Drop both temporary databases
#
# The RENAME TABLE statement is atomic - all renames happen together, so there's
# never a moment where tables are missing. Existing connections may get an error
# on their next query, but can immediately retry and succeed.
#
# The OLD_DB (grapher_old) is needed because MySQL can't rename a table to the
# same name in the same database in one step - we need somewhere to move the
# current tables while the new ones take their place.
set -o errexit
set -o pipefail
set -o nounset

if [ -e .env ]; then
    source .env
fi

: "${GRAPHER_DB_NAME:?Need to set GRAPHER_DB_NAME non-empty}"
: "${GRAPHER_DB_USER:?Need to set GRAPHER_DB_USER non-empty}"
: "${GRAPHER_DB_PASS:-Need to set GRAPHER_DB_PASS}"
: "${GRAPHER_DB_HOST:?Need to set GRAPHER_DB_HOST non-empty}"
: "${GRAPHER_DB_PORT:?Need to set GRAPHER_DB_PORT non-empty}"
: "${DATA_FOLDER:?Need to set DATA_FOLDER non-empty}"

_mysql() {
    if [ -z "$GRAPHER_DB_PASS" ]; then
        mysql --default-character-set=utf8mb4 --get-server-public-key -h"$GRAPHER_DB_HOST" -u"$GRAPHER_DB_USER" -P "${GRAPHER_DB_PORT}" "$@"
    else
        mysql --default-character-set=utf8mb4 --get-server-public-key -h"$GRAPHER_DB_HOST" -u"$GRAPHER_DB_USER" -p"$GRAPHER_DB_PASS" -P "${GRAPHER_DB_PORT}" "$@"
    fi
}

import_db() {
    cat $1 | gunzip | sed s/.\*DEFINER\=\`.\*// | grep -vF GLOBAL.GTID_PURGED | _mysql $2
}

swapGrapherDb() {
    local NEW_DB="${GRAPHER_DB_NAME}_new"
    local OLD_DB="${GRAPHER_DB_NAME}_old"

    # Check if main DB exists and has tables
    TABLE_COUNT=$(_mysql -N -e "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$GRAPHER_DB_NAME' AND TABLE_TYPE='BASE TABLE'" 2>/dev/null || echo "0")

    if [ "$TABLE_COUNT" = "0" ]; then
        echo "==> First-time setup: importing directly (no tables to swap)"
        _mysql --database="" -e "DROP DATABASE IF EXISTS $GRAPHER_DB_NAME; CREATE DATABASE $GRAPHER_DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;"
        import_db $DATA_FOLDER/owid_metadata.sql.gz $GRAPHER_DB_NAME
        echo "==> Grapher DB initial setup complete"
        return 0
    fi

    echo "==> Creating temporary database for new data"
    _mysql --database="" -e "DROP DATABASE IF EXISTS $NEW_DB; CREATE DATABASE $NEW_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;"

    echo "==> Importing data into temporary database"
    if [ -f "${DATA_FOLDER}/owid_metadata.sql.gz" ]; then
        import_db $DATA_FOLDER/owid_metadata.sql.gz $NEW_DB
    else
        echo "owid_metadata.sql.gz missing in ${DATA_FOLDER}. Refresh aborted."
        _mysql --database="" -e "DROP DATABASE IF EXISTS $NEW_DB;"
        return 1
    fi

    echo "==> Preparing atomic table swap"
    # Drop old backup database if exists, create fresh one
    _mysql --database="" -e "DROP DATABASE IF EXISTS $OLD_DB; CREATE DATABASE $OLD_DB CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_as_cs;"

    # Get view definitions from new DB BEFORE the swap (while tables still exist there)
    echo "==> Extracting view definitions"
    NEW_VIEWS=$(_mysql -N -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='$NEW_DB' AND TABLE_TYPE='VIEW'")
    declare -A VIEW_DEFS
    for VIEW in $NEW_VIEWS; do
        # Get the CREATE VIEW statement, strip DEFINER clause, and replace database references
        VIEW_DEF=$(_mysql -N -e "SHOW CREATE VIEW $NEW_DB.$VIEW" | cut -f2 | sed 's/ DEFINER=`[^`]*`@`[^`]*`//' | sed "s/\`$NEW_DB\`\./\`$GRAPHER_DB_NAME\`./g")
        VIEW_DEFS[$VIEW]="$VIEW_DEF"
    done

    # Get list of tables in new DB (incoming data)
    NEW_TABLES=$(_mysql -N -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='$NEW_DB' AND TABLE_TYPE='BASE TABLE'")

    # Get list of tables in main (current data)
    MAIN_TABLES=$(_mysql -N -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='$GRAPHER_DB_NAME' AND TABLE_TYPE='BASE TABLE'")

    # Build the atomic rename command
    RENAME_CMD="RENAME TABLE "
    FIRST=true

    # For each table in new DB: swap if exists in main, otherwise just move to main
    for TABLE in $NEW_TABLES; do
        if [ "$FIRST" = true ]; then
            FIRST=false
        else
            RENAME_CMD+=", "
        fi

        # Check if table exists in main database
        if echo "$MAIN_TABLES" | grep -qw "$TABLE"; then
            # Table exists in both - swap them
            RENAME_CMD+="$GRAPHER_DB_NAME.$TABLE TO $OLD_DB.$TABLE, $NEW_DB.$TABLE TO $GRAPHER_DB_NAME.$TABLE"
        else
            # New table - just move from new DB to main
            RENAME_CMD+="$NEW_DB.$TABLE TO $GRAPHER_DB_NAME.$TABLE"
        fi
    done

    # For tables only in main (not in staging) - move to old (will be dropped with old DB)
    for TABLE in $MAIN_TABLES; do
        if ! echo "$NEW_TABLES" | grep -qw "$TABLE"; then
            if [ "$FIRST" = true ]; then
                FIRST=false
            else
                RENAME_CMD+=", "
            fi
            RENAME_CMD+="$GRAPHER_DB_NAME.$TABLE TO $OLD_DB.$TABLE"
        fi
    done

    echo "==> Executing atomic table swap"
    _mysql --database="" -e "$RENAME_CMD"

    # Handle views: drop existing views and recreate from extracted definitions
    # Views can't be renamed across databases, so we recreate them
    echo "==> Updating views"

    # Drop all existing views in main database
    MAIN_VIEWS=$(_mysql -N -e "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA='$GRAPHER_DB_NAME' AND TABLE_TYPE='VIEW'")
    for VIEW in $MAIN_VIEWS; do
        _mysql --database="$GRAPHER_DB_NAME" -e "DROP VIEW IF EXISTS $VIEW"
    done

    # Recreate views in main DB using the extracted definitions.
    # Use a retry loop to handle view-on-view dependencies (ordering)
    # and gracefully skip views that reference removed tables/columns.
    REMAINING_VIEWS=("${!VIEW_DEFS[@]}")
    ATTEMPT=1
    while [ ${#REMAINING_VIEWS[@]} -gt 0 ]; do
        FAILED_VIEWS=()
        for VIEW in "${REMAINING_VIEWS[@]}"; do
            if ! _mysql --database="$GRAPHER_DB_NAME" -e "${VIEW_DEFS[$VIEW]}" 2>/dev/null; then
                FAILED_VIEWS+=("$VIEW")
            fi
        done

        # If no progress was made, these views are truly broken - stop retrying
        if [ ${#FAILED_VIEWS[@]} -eq ${#REMAINING_VIEWS[@]} ]; then
            echo "WARNING: Could not create ${#FAILED_VIEWS[@]} view(s) after $ATTEMPT attempt(s):"
            for VIEW in "${FAILED_VIEWS[@]}"; do
                echo "  - $VIEW"
            done
            break
        fi

        REMAINING_VIEWS=("${FAILED_VIEWS[@]}")
        ((ATTEMPT++))
    done

    echo "==> Cleaning up"
    _mysql --database="" -e "DROP DATABASE IF EXISTS $NEW_DB; DROP DATABASE IF EXISTS $OLD_DB;"

    echo "==> Grapher DB refresh complete (atomic swap)"
}

swapGrapherDb
