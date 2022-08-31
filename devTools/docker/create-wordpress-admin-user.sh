#!/usr/bin/env  bash
set -o errexit
set -o pipefail
set -o nounset

: "${WORDPRESS_DB_NAME:?Need to set WORDPRESS_DB_NAME non-empty}"
: "${WORDPRESS_DB_USER:?Need to set WORDPRESS_DB_USER non-empty}"
: "${WORDPRESS_DB_PASS:?Need to set WORDPRESS_DB_PASS non-empty}"
: "${WORDPRESS_DB_PORT:?Need to set WORDPRESS_DB_PORT non-empty}"
: "${WORDPRESS_DB_HOST:?Need to set WORDPRESS_DB_HOST non-empty}"

_mysql() {
    mysql --default-character-set=utf8mb4 -u$WORDPRESS_DB_USER -p$WORDPRESS_DB_PASS -h $WORDPRESS_DB_HOST --port="${WORDPRESS_DB_PORT}" -e "$1" $WORDPRESS_DB_NAME
}

createWordpressAdminUser() {
    echo "Clearing wordpress password hashes"
    _mysql 'UPDATE wp_users SET user_pass = "";'

    echo "Adding the user admin@example.com with password 'admin'"
    _mysql 'INSERT INTO wp_users (user_login, user_email, user_pass, user_registered, user_nicename) VALUES ("admin", "admin@example.com", "$2y$10$2ilzpLslIA29cZezVXJTDOqLlkGyXK6YcNvr2QPvn95WdmVdnxl2S", NOW(), "Admin");'

    echo "Giving the admin user administrator privileges"
    _mysql 'INSERT INTO wp_usermeta (user_id, meta_key, meta_value) VALUES ((SELECT id FROM wp_users WHERE user_email = "admin@example.com"), "wp_capabilities", "a:1:{s:13:\"administrator\";s:1:\"1\";}");'
    _mysql 'INSERT INTO wp_usermeta (user_id, meta_key, meta_value) VALUES ((SELECT id FROM wp_users WHERE user_email = "admin@example.com"), "rich_editing", "true");'

    return 0
}

createWordpressAdminUser
