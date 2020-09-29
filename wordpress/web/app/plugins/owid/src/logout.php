<?php
// Note: not portable, very specific to this Wordpress install.
require_once(__DIR__ . '/../../../../wp/wp-blog-header.php');

// Verify the nonce to confirm intent (set in authentication.php)
if (check_admin_referer('log-out')) {
    wp_logout();
    $wp_login_url = wp_login_url();
    wp_die("You've been successfully logged out.", '', ["link_text" => "Log back in", "link_url" => wp_login_url()]);
}
