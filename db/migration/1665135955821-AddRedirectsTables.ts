import { MigrationInterface, QueryRunner } from "typeorm"

export class AddRedirectsTables1665135955821 implements MigrationInterface {
    public async up(db: QueryRunner): Promise<void> {
        await db.query(
            `-- sql
            -- ----------------------------------------------
            -- TABLES
            -- table for manual bulk redirects, for example /app/uploads/* -> /uploads/:splat
            -- these are not fully taken into account as the wildcards are not interpreted
            -- but stored here for completeness
            CREATE TABLE
            manual_bulk_redirects (
                id int auto_increment primary key,
                -- source slug, i.e. what should be matched by this redirect
                -- will be sanizited by triggers to never include a trailing slash unless it is the root path
                slug varchar(2048) not null,
                -- target domain to link to, can be empty which is understood to mean ourworldindata.org
                targetDomain varchar(255) not null default '',
                -- target path, e.g. /some/path
                -- will be sanizited by triggers to never include a trailing slash unless it is the root path
                targetPath varchar(2048) not null,
                -- target query (e.g. ?somekey=somevalue )
                targetQuery varchar(2048) not null default '',
                -- target fragment (e.g. #somefragment )
                targetFragment varchar(255) not null  default '',
                -- which kind of redirect to do, can be 301 or 302
                statusCode int not null,
                -- generated column with the domain and path concatted. This excludes query and fragment and is useful
                -- if you e.g. want to know which sites link to the same path, regardless of query and/or fragment
                targetLocation varchar(2100) generated always as (concat(targetDomain, targetPath)) virtual not null,
                -- generated column with the full target url, including query and fragment
                targetUrl varchar(5000) generated always as (
                concat(
                    targetDomain,
                    targetPath,
                    targetQuery,
                    targetFragment
                )
                ) virtual not null,
                -- md5 hashes. MySQL doesn't like check constraints on long VARCHARs so we use hashes to ensure
                -- some uniqueness constraints like source <> target or more complex ones that avoid redirect chains
                slugMd5 char(32) generated always as (md5(slug)) stored unique not null,
                targetUrlMd5 char(32) generated always as (md5(targetUrl)) stored not null,
                targetLocationMd5 char(32) generated always as (md5(targetLocation)) stored not null,
                constraint manual_bulk_redirects_slug_target_must_be_different check (slugMd5 <> targetUrlMd5)
            );
`,
            []
        )

        await db.query(
            `-- sql
            -- table for the wordpress redirects "as is", i.e. without cycle checks applied yet.
            -- Has a field validationError that is used to mark rows that are invalid for one reason
            -- or another
            CREATE TABLE
            wordpress_redirects_candidates (
                id int auto_increment primary key,
                wordpressId int unique not null,
                slug varchar(2048) not null,
                -- target domain to link to, can be empty which is understood to mean ourworldindata.org
                targetDomain varchar(255) not null default '',
                -- target path, e.g. /some/path
                -- will be sanizited by triggers to never include a trailing slash unless it is the root path
                targetPath varchar(2048) not null,
                -- target query (e.g. ?somekey=somevalue )
                targetQuery varchar(2048) not null default '',
                -- target fragment (e.g. #somefragment )
                targetFragment varchar(255) not null  default '',
                statusCode int not null,
                -- generated column with the domain and path concatted. This excludes query and fragment and is useful
                -- if you e.g. want to know which sites link to the same path, regardless of query and/or fragment
                targetLocation varchar(2100) generated always as (concat(targetDomain, targetPath)) virtual not null,
                -- generated column with the full target url, including query and fragment
                targetUrl varchar(5000) generated always as (
                concat(
                    targetDomain,
                    targetPath,
                    targetQuery,
                    targetFragment
                )
                ) virtual not null,
                slugMd5 char(32) generated always as (md5(slug)) stored not null,
                targetUrlMd5 char(32) generated always as (md5(targetUrl)) stored not null,
                targetLocationMd5 char(32) generated always as (md5(targetLocation)) stored not null,
                validationError ENUM('redirects-to-chart', 'redirects-to-self', 'duplicate-slugs'),
                shouldRedirectToChartId int references charts(id)
            );
`,
            []
        )

        await db.query(
            `-- sql
            -- table for wordpress redirects once they are cleaned up and validated
            CREATE TABLE
            wordpress_redirects (
                id int auto_increment primary key,
                wordpressId int unique not null,
                slug varchar(2048) not null,
                -- target domain to link to, can be empty which is understood to mean ourworldindata.org
                targetDomain varchar(255) not null default '',
                -- target path, e.g. /some/path
                -- will be sanizited by triggers to never include a trailing slash unless it is the root path
                targetPath varchar(2048) not null,
                -- target query (e.g. ?somekey=somevalue )
                targetQuery varchar(2048) not null default '',
                -- target fragment (e.g. #somefragment )
                targetFragment varchar(255) not null  default '',
                statusCode int not null,
                -- generated column with the domain and path concatted. This excludes query and fragment and is useful
                -- if you e.g. want to know which sites link to the same path, regardless of query and/or fragment
                targetLocation varchar(2100) generated always as (concat(targetDomain, targetPath)) virtual not null,
                -- generated column with the full target url, including query and fragment
                targetUrl varchar(5000) generated always as (
                concat(
                    targetDomain,
                    targetPath,
                    targetQuery,
                    targetFragment
                )
                ) virtual not null,
                slugMd5 char(32) generated always as (md5(slug)) stored unique not null,
                targetUrlMd5 char(32) generated always as (md5(targetUrl)) stored not null,
                targetLocationMd5 char(32) generated always as (md5(targetLocation)) stored not null,
                constraint wp_redirects_slug_target_must_be_different check (slugMd5 <> targetUrlMd5)
            );
            `,
            []
        )

        await db.query(
            `-- sql
            -- complete redirects table, including all redirects from wordpress, manual bulk redirects and
            -- redirects from the chart_slug_redirects table that redirects slugs to chart ids (resolved
            -- to paths when inserted into this table here)
            CREATE TABLE
            complete_redirects (
                id int auto_increment primary key,
                manualBulkRedirectId int references manual_bulk_redirects(id),
                wordpressRedirectId int references wordpress_redirects(id),
                chartSlugRedirectId int references chart_slug_redirects(id),
                slug varchar(2048) not null,
                -- target domain to link to, can be empty which is understood to mean ourworldindata.org
                targetDomain varchar(255) not null default '',
                -- target path, e.g. /some/path
                -- will be sanizited by triggers to never include a trailing slash unless it is the root path
                targetPath varchar(2048) not null,
                -- target query (e.g. ?somekey=somevalue )
                targetQuery varchar(2048) not null default '',
                -- target fragment (e.g. #somefragment )
                targetFragment varchar(255) not null  default '',
                statusCode int not null,
                constraint complete_redirects_one_fk_must_be_set check (
                manualBulkRedirectId is not null
                or wordpressRedirectId is not null
                or chartSlugRedirectId is not null
                ),
                -- generated column with the domain and path concatted. This excludes query and fragment and is useful
                -- if you e.g. want to know which sites link to the same path, regardless of query and/or fragment
                targetLocation varchar(2100) generated always as (concat(targetDomain, targetPath)) virtual not null,
                -- generated column with the full target url, including query and fragment
                targetUrl varchar(5000) generated always as (
                concat(
                    targetDomain,
                    targetPath,
                    targetQuery,
                    targetFragment
                )
                ) virtual not null,
                slugMd5 char(32) generated always as (md5(slug)) stored unique not null,
                targetUrlMd5 char(32) generated always as (md5(targetUrl)) stored not null,
                targetLocationMd5 char(32) generated always as (md5(targetLocation)) stored not null,
                constraint complete_redirects_slug_target_must_be_different check (slugMd5 <> targetUrlMd5)
            );
`,
            []
        )

        await db.query(
            `-- sql
            create table
                final_slugs (
                    id int auto_increment primary key,
                    slug varchar(2048) not null,
                    slugMd5 char(32) generated always as (md5(slug)) stored unique not null,
                    chartId int references charts(id),
                    -- explorerId int references explorers(id),
                    postId int references posts(id),
                    redirectId int references complete_redirects(id),
                    -- specialPageId int references special_pages(id),
                    constraint final_slugs_one_fk_must_be_set check (
                        chartId is not null
                        -- or explorerId is not null
                        or postId is not null
                        or redirectId is not null
                        -- or specialPageId is not null
                    )
                );
            `,
            []
        )

        // This query just tests if regex escaping works as expected
        await db.query(`-- sql
        select regexp_replace(
                'http://ourworldindata.org/test',
                '^((?<protocol>http|https)(:\\/\\/)(?<domain>[^\\/]+))?(?<path>\\/[^?#]*)?(?<query>\\\\?[^#]+)?(?<target>#.*)?',
                '$2$3$4'
            );
        `)

        await db.query(
            `-- sql
            -- -----------------------
            -- helper functions
            -- in theory MySQL regexp_replace should be able to work with named capture groups in Regexes and
            -- for individual queries it does but for some reason when used inside a function they
            -- don't work correcltly.
            -- i.e.
            -- regexp_replace(
            --     'https://test.com/blank,
            --     '^((?<protocol>http|https)(:\/\/)(?<domain>[^\/]+))?(?<path>\/[^?#]*)(?<query>\\?[^#]+)?(?<target>#.*)?$',
            --     '\${protocol}://\${domain}'
            --   );
            -- returns 'https://test.com'
            -- but when wrapped in a function like below, this call
            -- select extract_url_domain('https://test.com/blank');
            -- returns 'NULL://NULL'
            -- For this reason positional group indices are used instead even though they are less readable

            CREATE FUNCTION
                extract_url_domain(url VARCHAR(5000)) RETURNS VARCHAR(255) DETERMINISTIC
            RETURN
            regexp_replace(
                url,
                '^((?<protocol>http|https)(:\\/\\/)(?<domain>[^\\/]+))?(?<path>\\/[^?#]*)?(?<query>\\\\?[^#]+)?(?<target>#.*)?',
                '$2$3$4'
            );
`,
            []
        )

        await db.query(
            `-- sql
            CREATE FUNCTION
                extract_url_path(url VARCHAR(5000)) RETURNS VARCHAR(2048) DETERMINISTIC
            RETURN
            regexp_replace(
                url,
                '^((?<protocol>http|https)(:\\/\\/)(?<domain>[^\\/]+))?(?<path>\\/[^?#]*)?(?<query>\\\\?[^#]+)?(?<target>#.*)?',
                '$5'
            );
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE FUNCTION
                extract_url_query(url VARCHAR(5000)) RETURNS VARCHAR(2048) DETERMINISTIC
            RETURN
            regexp_replace(
                url,
                '^((?<protocol>http|https)(:\\/\\/)(?<domain>[^\\/]+))?(?<path>\\/[^?#]*)?(?<query>\\\\?[^#]+)?(?<target>#.*)?',
                '$6'
            );
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE FUNCTION
                extract_url_fragment(url VARCHAR(5000)) RETURNS VARCHAR(255) DETERMINISTIC
            RETURN
            regexp_replace(
                url,
                '^((?<protocol>http|https)(:\\/\\/)(?<domain>[^\\/]+))?(?<path>\\/[^?#]*)?(?<query>\\\\?[^#]+)?(?<target>#.*)?',
                '$7'
            );
            `,
            []
        )

        await db.query(
            `-- sql
            -- ----------------------------------------------
            -- TRIGGERS

            -- wordpress_redirects_candidates

            CREATE TRIGGER
                wp_redirects_candidates_remove_slash_on_slug_insert
            BEFORE INSERT ON wordpress_redirects_candidates
            FOR EACH ROW
            BEGIN
                IF NEW.slug <> '/' THEN
                    SET NEW.slug = TRIM(
                        TRAILING '/'
                        FROM
                        NEW.slug
                    );
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                wp_redirects_candidates_remove_slash_on_slug_update
            BEFORE UPDATE ON wordpress_redirects_candidates
            FOR EACH ROW
            BEGIN
                IF NEW.slug <> '/' THEN
                    SET
                    NEW.slug = TRIM(
                        TRAILING '/'
                        FROM
                        NEW.slug
                    );
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                wp_redirects_candidates_remove_slash_on_target_path_insert
            BEFORE INSERT ON wordpress_redirects_candidates
            FOR EACH ROW
            BEGIN
                IF NEW.targetPath <> '/' THEN
                    SET
                    NEW.targetPath = TRIM(
                        TRAILING '/'
                        FROM
                        NEW.targetPath
                    );
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                wp_redirects_candidates_remove_slash_on_target_path_update
            BEFORE UPDATE ON wordpress_redirects_candidates
            FOR EACH ROW
            BEGIN
                IF NEW.targetPath <> '/' THEN
                    SET
                    NEW.targetPath = TRIM(
                        TRAILING '/'
                        FROM
                        NEW.targetPath
                    );
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                wp_redirects_candidates_normalize_domain_on_insert
            BEFORE INSERT ON wordpress_redirects_candidates
            FOR EACH ROW
            BEGIN
                IF NEW.targetDomain = 'http://ourworldindata.org' or NEW.targetDomain = 'https://ourworldindata.org' THEN
                    SET NEW.targetDomain = '';
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                wp_redirects_candidates_normalize_domain_on_update
            BEFORE UPDATE ON wordpress_redirects_candidates
            FOR EACH ROW
            BEGIN
                IF NEW.targetDomain = 'http://ourworldindata.org' or NEW.targetDomain = 'https://ourworldindata.org' THEN
                    SET NEW.targetDomain = '';
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            -- ----------------------------------------------
            -- wordpress_redirects
            CREATE TRIGGER
                wp_redirects_remove_slash_on_slug_insert
            BEFORE INSERT ON wordpress_redirects
            FOR EACH ROW
            BEGIN
                IF NEW.slug <> '/' THEN
                    SET
                    NEW.slug = TRIM(
                        TRAILING '/'
                        FROM
                        NEW.slug
                    );
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                wp_redirects_remove_slash_on_slug_update
            BEFORE UPDATE ON wordpress_redirects
            FOR EACH ROW
            BEGIN
                IF NEW.slug <> '/' THEN
                    SET
                    NEW.slug = TRIM(
                        TRAILING '/'
                        FROM
                        NEW.slug
                    );
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                wp_redirects_remove_slash_on_target_path_insert
            BEFORE INSERT ON wordpress_redirects
            FOR EACH ROW
            BEGIN
                IF NEW.targetPath <> '/' THEN
                SET
                NEW.targetPath = TRIM(
                    TRAILING '/'
                    FROM
                    NEW.targetPath
                );
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                wp_redirects_remove_slash_on_target_path_update
            BEFORE UPDATE ON wordpress_redirects
            FOR EACH ROW
            BEGIN
                IF NEW.targetPath <> '/' THEN
                    SET
                    NEW.targetPath = TRIM(
                        TRAILING '/'
                        FROM
                        NEW.targetPath
                    );
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                wp_redirects_normalize_domain_on_insert
            BEFORE INSERT ON wordpress_redirects
            FOR EACH ROW
            BEGIN
                IF NEW.targetDomain = 'http://ourworldindata.org' or NEW.targetDomain = 'https://ourworldindata.org' THEN
                    SET NEW.targetDomain = '';
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                wp_redirects_normalize_domain_on_update
            BEFORE UPDATE ON wordpress_redirects
            FOR EACH ROW
            BEGIN
                IF NEW.targetDomain = 'http://ourworldindata.org' or NEW.targetDomain = 'https://ourworldindata.org' THEN
                    SET NEW.targetDomain = '';
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            -- this trigger checks that the row that is about to be inserted
            --  a) does not have a slug that is already used in the targetLocation column
            --  b) does not have a targetLocation that is already used in the slug column
            -- By doing both, redirect chains are forbidden. If either of those cases
            -- happens, the trigger bails with a signal which will make the transaction abort.
            CREATE TRIGGER
                wp_redirects_ensure_no_redirect_chains_on_insert
            BEFORE INSERT ON wordpress_redirects
            FOR EACH ROW
            BEGIN
                declare msg varchar(4000);
                -- check if the slug is already used in the targetLocation column
                IF ((SELECT
                        count(*)
                    FROM
                        wordpress_redirects wr
                    WHERE
                        wr.targetLocationMd5 = md5(NEW.slug)
                ) > 0) THEN
                    SET msg = concat(
                        'Redirect chain detected! Source slug to be inserted existed as a target:',
                        NEW.slug
                    );
                    -- signal an error to abort the transaction
                    signal sqlstate '45000' set message_text = msg;
                end if;

                -- check if the targetLocation is already used in the slug column
                if ((select
                        count(*)
                    from
                        wordpress_redirects wr
                    where
                        wr.slugMd5 = md5(
                            concat(NEW.targetDomain, NEW.targetPath))
                    ) > 0
                ) THEN
                    set msg = concat(
                        'Redirect chain detected! Target path existed as a source slug:',
                        concat(NEW.targetDomain, NEW.targetPath)
                    );
                    -- signal an error to abort the transaction
                    signal sqlstate '45000' set message_text = msg;
                end if;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            -- this trigger checks that the row that is about to be updated
            --  a) does not have a slug that is already used in the targetLocation column
            --  b) does not have a targetLocation that is already used in the slug column
            -- By doing both, redirect chains are forbidden. If either of those cases
            -- happens, the trigger bails with a signal which will make the transaction abort.
            CREATE TRIGGER
                wp_redirects_ensure_no_redirect_chains_on_update
            BEFORE UPDATE ON wordpress_redirects
            FOR EACH ROW
            BEGIN
                declare msg varchar(4000);
                if ((select
                        count(*)
                    from
                        wordpress_redirects
                    where
                        md5(NEW.slug) = targetLocationMd5)
                > 0) THEN
                    set msg = concat(
                        'Redirect chain detected! Source slug to be inserted existed as a target:',
                        NEW.slug
                    );
                    signal sqlstate '45000' set message_text = msg;
                end if;

                if ((select
                        count(*)
                    from
                        wordpress_redirects
                    where
                        md5(
                            concat(NEW.targetDomain, NEW.targetPath)
                        ) = slugMd5)
                > 0 ) THEN
                    set msg = concat(
                        'Redirect chain detected! Target path existed as a source slug:',
                        concat(NEW.targetDomain, NEW.targetPath)
                    );

                    signal sqlstate '45000' set message_text = msg;
                end if;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            -- triggers for syncing wordpress_redirects entries into complete_redirects

            CREATE TRIGGER
                wp_redirects_insert_complete
            AFTER INSERT ON
                wordpress_redirects
            FOR EACH ROW
            INSERT INTO
            complete_redirects (
                wordpressRedirectId,
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            VALUES
            (
                NEW.id,
                NEW.slug,
                NEW.targetDomain,
                NEW.targetPath,
                NEW.targetQuery,
                NEW.targetFragment,
                NEW.statusCode
            );
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                wp_redirects_update_complete
            AFTER UPDATE
                ON wordpress_redirects
            FOR EACH ROW
            UPDATE
                complete_redirects
            SET
                slug = NEW.slug,
                targetDomain = NEW.targetDomain,
                targetPath = NEW.targetPath,
                targetQuery = NEW.targetQuery,
                targetFragment = NEW.targetFragment,
                statusCode = NEW.statusCode
            WHERE
                wordpressRedirectId = NEW.id;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                wp_redirects_delete_complete
            AFTER DELETE
                ON wordpress_redirects
            FOR EACH ROW
            DELETE FROM
                complete_redirects
            WHERE
                wordpressRedirectId = OLD.id;

`,
            []
        )

        await db.query(
            `-- sql
            -- manual_bulk_redirects
            CREATE TRIGGER
                bulk_redirects_remove_slash_on_slug_insert
            BEFORE INSERT ON manual_bulk_redirects
            FOR EACH ROW
            BEGIN
                IF NEW.slug <> '/' THEN
                    SET NEW.slug = TRIM(
                        TRAILING '/'
                        FROM
                        NEW.slug
                    );
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                bulk_redirects_remove_slash_on_slug_update
            BEFORE UPDATE
                ON manual_bulk_redirects
            FOR EACH ROW
            BEGIN
                IF NEW.slug <> '/' THEN
                    SET NEW.slug = TRIM(
                        TRAILING '/'
                        FROM
                        NEW.slug
                    );
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                bulk_redirects_remove_slash_on_target_path_insert
            BEFORE INSERT
                ON manual_bulk_redirects
            FOR EACH ROW
            BEGIN
                IF NEW.targetPath <> '/' THEN
                    SET NEW.targetPath = TRIM(
                        TRAILING '/'
                        FROM
                        NEW.targetPath
                    );
                END IF;
            END;

`,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                bulk_redirects_remove_slash_on_target_path_update
            BEFORE UPDATE ON manual_bulk_redirects
            FOR EACH ROW
            BEGIN
                IF NEW.targetPath <> '/' THEN
                    SET NEW.targetPath = TRIM(
                        TRAILING '/'
                        FROM
                        NEW.targetPath
                    );
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                bulk_redirects_ensure_no_redirect_chains_on_insert
            BEFORE INSERT ON manual_bulk_redirects
            FOR EACH ROW
            BEGIN
                declare msg varchar(4000);
                if ((select
                        count(*)
                    from
                        manual_bulk_redirects r
                    where
                        r.targetLocationMd5 = md5(NEW.slug)
                ) > 0) THEN
                    set msg = concat(
                        'Redirect chain detected! Source slug to be inserted existed as a target:',
                        NEW.slug
                    );
                    signal sqlstate '45000' set message_text = msg;
                end if;

                if ((select
                        count(*)
                    from
                        manual_bulk_redirects r
                    where
                    r.slugMd5 = md5(
                        concat(NEW.targetDomain, NEW.targetPath))
                ) > 0) THEN
                    set msg = concat(
                        'Redirect chain detected! Target path existed as a source slug:',
                        concat(NEW.targetDomain, NEW.targetPath)
                    );
                    signal sqlstate '45000' set message_text = msg;
                end if;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                bulk_redirects_ensure_no_redirect_chains_on_update
            BEFORE UPDATE ON manual_bulk_redirects
            FOR EACH ROW
            BEGIN
                declare msg varchar(4000);
                if ((select
                        count(*)
                    from
                        manual_bulk_redirects
                    where
                        md5(NEW.slug) = targetLocationMd5
                ) > 0) THEN
                    set msg = concat(
                        'Redirect chain detected! Source slug to be inserted existed as a target:',
                        NEW.slug
                    );
                    signal sqlstate '45000' set message_text = msg;
                end if;

                if ((select
                        count(*)
                    from
                        manual_bulk_redirects
                    where
                        md5(
                            concat(NEW.targetDomain, NEW.targetPath)
                        ) = slugMd5
                ) > 0) THEN
                    set msg = concat(
                        'Redirect chain detected! Target path existed as a source slug:',
                        concat(NEW.targetDomain, NEW.targetPath)
                    );
                    signal sqlstate '45000' set message_text = msg;
                end if;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                bulk_redirects_insert_complete
            AFTER INSERT
                ON manual_bulk_redirects
            FOR EACH ROW
            INSERT INTO
                complete_redirects (
                manualBulkRedirectId,
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            VALUES
            (
                NEW.id,
                NEW.slug,
                NEW.targetDomain,
                NEW.targetPath,
                NEW.targetQuery,
                NEW.targetFragment,
                NEW.statusCode
            );
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                bulk_redirects_update_complete
            AFTER UPDATE
                ON manual_bulk_redirects
            FOR EACH ROW
            UPDATE
                complete_redirects
            SET
                slug = NEW.slug,
                targetDomain = NEW.targetDomain,
                targetPath = NEW.targetPath,
                targetQuery = NEW.targetQuery,
                targetFragment = NEW.targetFragment,
                statusCode = NEW.statusCode
            WHERE
                manualBulkRedirectId = NEW.id;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                bulk_redirects_delete_complete
            AFTER DELETE
                ON manual_bulk_redirects
            FOR EACH ROW
            DELETE FROM
                complete_redirects
            WHERE
                manualBulkRedirectId = OLD.id;
            `,
            []
        )

        await db.query(
            `-- sql
            -- chart_slug_redirects
            CREATE TRIGGER
                chart_slug_redirects_insert_complete
            AFTER INSERT
                ON chart_slug_redirects FOR EACH ROW
            INSERT INTO
                complete_redirects (
                chartSlugRedirectId,
                slug,
                targetPath,
                statusCode
            )
            SELECT
                NEW.id,
                NEW.slug,
                concat('/grapher/', c.config ->> '$.slug'),
                302
            FROM
                charts c
            WHERE
                c.id = NEW.chart_id;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                chart_update_complete_redirects
            AFTER UPDATE
                ON charts
            FOR EACH ROW
            UPDATE
                complete_redirects
            SET
                targetPath = concat('/grapher/', NEW.config ->> '$.slug')
            WHERE
                chartSlugRedirectId in (
                select id from chart_slug_redirects
                where
                chart_id = NEW.id)
            ;
            `,
            []
        )

        await db.query(
            `-- sql
                CREATE TRIGGER
                    chart_slug_redirects_update_complete AFTER
                UPDATE
                    ON chart_slug_redirects
                FOR EACH ROW
                BEGIN
                    IF NEW.chart_id <> OLD.chart_id THEN
                        UPDATE
                        complete_redirects
                        join charts c on c.id = NEW.chart_id
                        SET
                        slug = NEW.slug,
                        targetPath = concat('/grapher/', c.config ->> '$.slug')
                        WHERE
                        complete_redirects.chartSlugRedirectId = OLD.id;
                    ELSE
                        UPDATE
                        complete_redirects
                        SET
                        slug = NEW.slug
                        WHERE
                        complete_redirects.chartSlugRedirectId = NEW.id;
                    END IF;
                END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                chart_slug_redirects_delete_complete AFTER
            DELETE
                ON chart_slug_redirects FOR EACH ROW
            DELETE FROM
                complete_redirects
            WHERE
                chartSlugRedirectId = OLD.id;
            `,
            []
        )

        await db.query(
            `-- sql
            -- final slugs table sync

            -- insert, update and delete triggers for charts to final_slugs
            CREATE TRIGGER
                chart_insert_final_slugs
            AFTER INSERT ON charts
            FOR EACH ROW
            INSERT INTO
                final_slugs (
                slug,
                chartId
            )
            VALUES
            (
                concat('/grapher/', NEW.config ->> '$.slug'),
                NEW.id
            );
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                chart_update_final_slugs
            AFTER UPDATE
                ON charts
            FOR EACH ROW
            UPDATE
                final_slugs
            SET
                slug = concat('/grapher/', NEW.config ->> '$.slug')
            WHERE
                chartId = OLD.id;

            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                chart_delete_final_slugs
            AFTER DELETE
                ON charts
            FOR EACH ROW
            DELETE FROM
                final_slugs
            WHERE
                chartId = OLD.id;

            `,
            []
        )

        await db.query(
            `-- sql
            -- insert, update and delete triggers for posts to final_slugs
            CREATE TRIGGER
                posts_insert_final_slugs
            AFTER INSERT ON posts
            FOR EACH ROW
            INSERT INTO
                final_slugs (
                slug,
                postId
            )
            VALUES
            (
                NEW.slug,
                NEW.id
            );
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                posts_update_final_slugs
            AFTER UPDATE
                ON posts
            FOR EACH ROW
            UPDATE
                final_slugs
            SET
                slug = NEW.slug
            WHERE
                postId = OLD.id;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                posts_delete_final_slugs
            AFTER DELETE
                ON charts
            FOR EACH ROW
            DELETE FROM
                final_slugs
            WHERE
                postId = OLD.id;
            `,
            []
        )

        await db.query(
            `-- sql
            -- insert, update and delete triggers for complete_redirects to final_slugs
            CREATE TRIGGER
                complete_redirects_insert_final_slugs
            AFTER INSERT ON complete_redirects
            FOR EACH ROW
            BEGIN
                IF NEW.targetDomain = '' THEN
                    INSERT INTO
                    final_slugs (
                        slug,
                        redirectId
                    )
                    VALUES
                    (
                        NEW.slug,
                        NEW.id
                    );
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                complete_redirects_update_final_slugs
            AFTER UPDATE
                ON complete_redirects
            FOR EACH ROW
            BEGIN
                IF NEW.targetDomain = '' and OLD.targetDomain <> '' THEN
                    INSERT INTO
                    final_slugs (
                        slug,
                        redirectId
                    )
                    VALUES
                    (
                        NEW.slug,
                        NEW.id
                    );
                ELSEIF NEW.targetDomain <> '' and OLD.targetDomain = '' THEN
                    DELETE FROM
                    final_slugs
                    WHERE
                    redirectId = OLD.id;
                ELSEIF NEW.targetDomain = '' and OLD.targetDomain = '' THEN
                    UPDATE
                    final_slugs
                    SET
                    slug = NEW.slug
                    WHERE
                    redirectId = OLD.id;
                END IF;
            END;
            `,
            []
        )

        await db.query(
            `-- sql
            CREATE TRIGGER
                complete_redirects_delete_final_slugs
            AFTER DELETE
                ON complete_redirects
            FOR EACH ROW
            DELETE FROM
                final_slugs
            WHERE
                redirectId = OLD.id;
            `,
            []
        )

        await db.query(
            `-- sql
            -- ---------------------------------------------
            -- Filling/updating redirects tables

            -- remove rows from chart_slug_redirects that redirect to the current slug (this is no longer allowed)
            delete from
                chart_slug_redirects as csr
            where
                csr.slug IN (
                select
                slug
                from
                (
                    select
                    csr.slug as slug
                    from
                    chart_slug_redirects csr
                    join charts c on csr.chart_id = c.id
                    where
                    c.config ->> '$.slug' = csr.slug
                ) as csrInner
            );
            `,
            []
        )

        await db.query(
            `-- sql
            -- we have some charts that have slugs that also appear in chart_slug_redirects. In this case
            -- the chart_slug_redirects entry wins. For example if there is are two charts:
            -- { slug: 'foo', id: 1 } and { slug: 'bar', id:2 }
            -- and a chart_slug_redirects entry for { slug: 'foo', chartId: 2 } then
            -- when you navigate to /grapher/foo you will get the chart 2. There is then no way
            -- to see the baked chart that has slug 'foo'.
            -- Because of this we update here the charts that have such "shadowed" slugs to the original
            -- slug prefixed by 'superseded-'.
            update charts
            set config = JSON_SET(config, '$.slug', concat('superseded-', config ->> '$.slug'))
            where id in
            (select id from (select c.id as id
            from chart_slug_redirects csr
            inner join charts c on c.config ->> '$.slug' = csr.slug) as t)
            `,
            []
        )

        await db.query(
            `-- sql
            -- final slugs from charts
            insert into final_slugs (slug, chartId)
            select concat('/grapher/', config ->> '$.slug'), id from charts
            where publishedAt is not null
            `,
            []
        )

        await db.query(
            `-- sql
            -- final slugs from posts

            insert into final_slugs (slug, postId)
            select slug, id from posts
            where status = 'publish'
            `,
            []
        )

        await db.query(
            `-- sql
            -- insert all existing chart_slug_redirects into complete_redirects
            insert into
                complete_redirects(
                chartSlugRedirectId,
                slug,
                targetPath,
                statusCode
            )
            SELECT
                csr.id,
                concat('/grapher/', csr.slug),
                concat('/grapher/', c.config ->> '$.slug'),
                302
            FROM
                chart_slug_redirects csr
                join charts c on csr.chart_id = c.id;
            `,
            []
        )

        await db.query(
            `-- sql
            -- insert manual bulk redirects
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/feed',
                extract_url_domain('/atom.xml'),
                extract_url_path('/atom.xml'),
                extract_url_query('/atom.xml'),
                extract_url_fragment('/atom.xml'),
                302
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/wp-admin/*',
                extract_url_domain('https://owid.cloud/wp/wp-admin/:splat'),
                extract_url_path('https://owid.cloud/wp/wp-admin/:splat'),
                extract_url_query('https://owid.cloud/wp/wp-admin/:splat'),
                extract_url_fragment('https://owid.cloud/wp/wp-admin/:splat'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/grapher/admin/*',
                extract_url_domain('https://owid.cloud/grapher/admin/:splat'),
                extract_url_path('https://owid.cloud/grapher/admin/:splat'),
                extract_url_query('https://owid.cloud/grapher/admin/:splat'),
                extract_url_fragment('https://owid.cloud/grapher/admin/:splat'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/wp-content/uploads/*',
                extract_url_domain('/uploads/:splat'),
                extract_url_path('/uploads/:splat'),
                extract_url_query('/uploads/:splat'),
                extract_url_fragment('/uploads/:splat'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/app/uploads/*',
                extract_url_domain('/uploads/:splat'),
                extract_url_path('/uploads/:splat'),
                extract_url_query('/uploads/:splat'),
                extract_url_fragment('/uploads/:splat'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/roser/*',
                extract_url_domain('https://www.maxroser.com/roser/:splat'),
                extract_url_path('https://www.maxroser.com/roser/:splat'),
                extract_url_query('https://www.maxroser.com/roser/:splat'),
                extract_url_fragment('https://www.maxroser.com/roser/:splat'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/uploads/nvd3/*',
                extract_url_domain(
                'https://www.maxroser.com/owidUploads/nvd3/:splat'
                ),
                extract_url_path(
                'https://www.maxroser.com/owidUploads/nvd3/:splat'
                ),
                extract_url_query(
                'https://www.maxroser.com/owidUploads/nvd3/:splat'
                ),
                extract_url_fragment(
                'https://www.maxroser.com/owidUploads/nvd3/:splat'
                ),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/uploads/datamaps/*',
                extract_url_domain(
                'https://www.maxroser.com/owidUploads/datamaps/:splat'
                ),
                extract_url_path(
                'https://www.maxroser.com/owidUploads/datamaps/:splat'
                ),
                extract_url_query(
                'https://www.maxroser.com/owidUploads/datamaps/:splat'
                ),
                extract_url_fragment(
                'https://www.maxroser.com/owidUploads/datamaps/:splat'
                ),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/slides/Max_PPT_presentations/*',
                extract_url_domain(
                'https://www.maxroser.com/slides/Max_PPT_presentations/:splat'
                ),
                extract_url_path(
                'https://www.maxroser.com/slides/Max_PPT_presentations/:splat'
                ),
                extract_url_query(
                'https://www.maxroser.com/slides/Max_PPT_presentations/:splat'
                ),
                extract_url_fragment(
                'https://www.maxroser.com/slides/Max_PPT_presentations/:splat'
                ),
                301
            );

            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/slides/Max_Interactive_Presentations/*',
                extract_url_domain(
                'https://www.maxroser.com/slides/Max_Interactive_Presentations/:splat'
                ),
                extract_url_path(
                'https://www.maxroser.com/slides/Max_Interactive_Presentations/:splat'
                ),
                extract_url_query(
                'https://www.maxroser.com/slides/Max_Interactive_Presentations/:splat'
                ),
                extract_url_fragment(
                'https://www.maxroser.com/slides/Max_Interactive_Presentations/:splat'
                ),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/entries/*',
                extract_url_domain('/:splat'),
                extract_url_path('/:splat'),
                extract_url_query('/:splat'),
                extract_url_fragment('/:splat'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/entries',
                extract_url_domain('/#entries'),
                extract_url_path('/#entries'),
                extract_url_query('/#entries'),
                extract_url_fragment('/#entries'),
                302
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/data/food-agriculture/*',
                extract_url_domain('/:splat'),
                extract_url_path('/:splat'),
                extract_url_query('/:splat'),
                extract_url_fragment('/:splat'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/data/political-regimes/*',
                extract_url_domain('/:splat'),
                extract_url_path('/:splat'),
                extract_url_query('/:splat'),
                extract_url_fragment('/:splat'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/data/population-growth-vital-statistics/*',
                extract_url_domain('/:splat'),
                extract_url_path('/:splat'),
                extract_url_query('/:splat'),
                extract_url_fragment('/:splat'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/data/growth-and-distribution-of-prosperity/*',
                extract_url_domain('/:splat'),
                extract_url_path('/:splat'),
                extract_url_query('/:splat'),
                extract_url_fragment('/:splat'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/chart-builder/*',
                extract_url_domain('/grapher/:splat'),
                extract_url_path('/grapher/:splat'),
                extract_url_query('/grapher/:splat'),
                extract_url_fragment('/grapher/:splat'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/grapher/public/*',
                extract_url_domain('/grapher/:splat'),
                extract_url_path('/grapher/:splat'),
                extract_url_query('/grapher/:splat'),
                extract_url_fragment('/grapher/:splat'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/grapher/view/*',
                extract_url_domain('/grapher/:splat'),
                extract_url_path('/grapher/:splat'),
                extract_url_query('/grapher/:splat'),
                extract_url_fragment('/grapher/:splat'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/slides/*',
                extract_url_domain('https://slides.ourworldindata.org/:splat'),
                extract_url_path('https://slides.ourworldindata.org/:splat'),
                extract_url_query('https://slides.ourworldindata.org/:splat'),
                extract_url_fragment('https://slides.ourworldindata.org/:splat'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                manual_bulk_redirects(
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            values
            (
                '/subscribe',
                extract_url_domain('/#subscribe'),
                extract_url_path('/#subscribe'),
                extract_url_query('/#subscribe'),
                extract_url_fragment('/#subscribe'),
                301
            );
            `,
            []
        )

        await db.query(
            `-- sql
            -- insert all existing wordpress redirects
            insert into
                wordpress_redirects_candidates(
                wordpressId,
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            SELECT
                id,
                url,
                extract_url_domain(action_data),
                extract_url_path(action_data),
                extract_url_query(action_data),
                extract_url_fragment(action_data),
                action_code
            FROM
                wordpress.wp_redirection_items
            WHERE
                status = 'enabled';
            `,
            []
        )

        await db.query(
            `-- sql
            -- we don't allow duplicate slugs. This is a bit tricky to filter out - basically
            -- it requires to find all the slugs where a group on slug with having count(*) > 1;
            -- then rows matching that slug need to be selected and partitioned on slug;
            -- then all but the first row have to be selected and updated and the validationError set
            -- to duplicate-slugs.
            -- Keeping the first item when ordered by "slug, targetPath" is a bit arbitrary. In effect
            -- at the time of writing this query in Oct 2022, there are three such duplicate slugs,
            -- two of which are identical (so it doesn't matter which one we keep) and one of which
            -- redirects /grapher once to / and once to /owid-grapher of which we want to keep the former.

            update
                wordpress_redirects_candidates
            set
                validationError = 'duplicate-slugs'
            where
                id in (
                select
                    id
                from
                    (
                    select
                        id,
                        slug,
                        targetPath,
                        row_number() over
                            (partition by slug
                            order by slug, targetPath)
                            as rowNum
                    from
                        wordpress_redirects_candidates
                    where
                        slug in (
                            select
                                slug
                            from
                                wordpress_redirects_candidates
                            where
                                validationError is NULL
                            group by
                                slug
                            having
                                count(slugMd5) > 1)
            ) as t
                where
                    rowNum <> 1
            );
`,
            []
        )

        await db.query(
            `-- sql
            -- there may be existing redirect chains (think A -> B, B -> C). We want to
            -- flatten those so that we get A -> C and B -> C. If while doing this we get into
            -- places where we have a redirect loop (A -> B, B -> A), we mark those as errors.
            update
                wordpress_redirects_candidates as first,
                wordpress_redirects_candidates as second
            set
                first.targetPath = second.targetPath,
                first.targetQuery = second.targetQuery,
                first.targetFragment = second.targetFragment,
                first.validationError = IF(second.slug = first.targetLocation, 'redirects-to-self', coalesce(first.validationError, second.validationError))
            where
                first.targetPath = second.slug
            `,
            []
        )

        await db.query(
            `-- sql
            -- because the above query only resolves a single level of redirect chains, we
            -- run the same query two more times. This is the first repeat of the query above.
            update
                wordpress_redirects_candidates as first,
                wordpress_redirects_candidates as second
            set
                first.targetPath = second.targetPath,
                first.targetQuery = second.targetQuery,
                first.targetFragment = second.targetFragment,
                first.validationError = IF(second.slug = first.targetLocation, 'redirects-to-self', coalesce(first.validationError, second.validationError))
            where
                first.targetPath = second.slug
            `,
            []
        )

        await db.query(
            `-- sql
            -- because the above query only resolves a single level of redirect chains, we
            -- run the same query two more times. This is the second repeat of the query above.
            update
                wordpress_redirects_candidates as first,
                wordpress_redirects_candidates as second
            set
                first.targetPath = second.targetPath,
                first.targetQuery = second.targetQuery,
                first.targetFragment = second.targetFragment,
                first.validationError = IF(second.slug = first.targetLocation, 'redirects-to-self', coalesce(first.validationError, second.validationError))
            where
                first.targetPath = second.slug
            `,
            []
        )

        await db.query(
            `-- sql
            -- we don't allow redirects to the same page, mark such rows as error
            update
                wordpress_redirects_candidates
            set validationError = 'redirects-to-self'
            where
                slugMd5 = targetLocationMd5;
            `,
            []
        )

        await db.query(
            `-- sql
            -- Some wordpress redirects may point to target paths that are
            -- already pointing to charts. For these we want to create new entries
            -- in chart_slug_redirects and mark the ones in wordpress_redirects_candidates
            -- as invalid.
            update
                wordpress_redirects_candidates wrc,
                chart_slug_redirects csr
            set
                wrc.validationError = 'redirects-to-chart',
                wrc.shouldRedirectToChartId = csr.chart_id
            where
                wrc.targetLocation COLLATE utf8mb4_0900_as_cs  = concat('/grapher/', csr.slug) COLLATE utf8mb4_0900_as_cs;
            `,
            []
        )

        await db.query(
            `-- sql
            -- Some wordpress redirects may point to target paths that are
            -- already pointing to charts. For these we want to create new entries
            -- in chart_slug_redirects and mark the ones in wordpress_redirects_candidates
            -- as invalid.
            update
                wordpress_redirects_candidates wrc,
                charts
            set
                wrc.validationError = 'redirects-to-chart',
                wrc.shouldRedirectToChartId = charts.id
            where
                wrc.targetLocation = concat('/grapher/', charts.config ->> '$.slug');
            `,
            []
        )

        await db.query(
            `-- sql
            -- Similar to the chart_slug_redirects that can "shadow" some charts, a similar thing
            -- can happen with wordress_redirects. Slugs that are no longer reachable because a
            -- wordpress_redirect will take precedence for a slug get renamed now (prefixed with "superseded-"),
            -- so that there will be no collisions in final_slugs
            update charts
            set config = JSON_SET(config, '$.slug', concat('superseded-', config ->> '$.slug'))
            where id in
            (select t.id from (select c.id as id
            from wordpress_redirects_candidates wrc
            inner join charts c on concat('/grapher/', c.config ->> '$.slug') = wrc.slug) as t)
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                chart_slug_redirects (slug, chart_id)
            select
                slug, shouldRedirectToChartId
            from wordpress_redirects_candidates
            where shouldRedirectToChartId is not null;
            `,
            []
        )

        await db.query(
            `-- sql
            insert into
                wordpress_redirects(
                wordpressId,
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            )
            SELECT
                wordpressId,
                slug,
                targetDomain,
                targetPath,
                targetQuery,
                targetFragment,
                statusCode
            FROM
                wordpress_redirects_candidates
            WHERE
                validationError is null;
            `,
            []
        )
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE manual_bulk_redirects`)
        await queryRunner.query(`DROP TABLE wordpress_redirects`)
        await queryRunner.query(`DROP TABLE wordpress_redirects_candidates`)
        await queryRunner.query(`DROP TABLE complete_redirects`)
        await queryRunner.query(`DROP TABLE final_slugs`)
        await queryRunner.query(`DROP FUNCTION extract_url_domain`)
        await queryRunner.query(`DROP FUNCTION extract_url_path`)
        await queryRunner.query(`DROP FUNCTION extract_url_query`)
        await queryRunner.query(`DROP FUNCTION extract_url_fragment`)
        await queryRunner.query(
            `DROP TRIGGER chart_slug_redirects_insert_complete`
        )
        await queryRunner.query(`DROP TRIGGER chart_update_complete_redirects`)
        await queryRunner.query(
            `DROP TRIGGER chart_slug_redirects_update_complete`
        )
        await queryRunner.query(
            `DROP TRIGGER chart_slug_redirects_delete_complete`
        )
        await queryRunner.query(`DROP TRIGGER chart_insert_final_slugs`)
        await queryRunner.query(`DROP TRIGGER chart_update_final_slugs`)
        await queryRunner.query(`DROP TRIGGER chart_delete_final_slugs`)
        await queryRunner.query(`DROP TRIGGER posts_insert_final_slugs`)
        await queryRunner.query(`DROP TRIGGER posts_update_final_slugs`)
        await queryRunner.query(`DROP TRIGGER posts_delete_final_slugs`)
    }
}
