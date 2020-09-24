<?php

namespace OWID;

use Lcobucci\JWT\Parser;
use Lcobucci\JWT\Signer\Key;
use Lcobucci\JWT\Signer\Rsa\Sha256;

function auth_cloudflare_sso($user, $username, $password)
{
    $jwt = $_COOKIE["CF_Authorization"] ?? null;
    if ($jwt) {
        // Get the Cloudflare public key
        $certsUrl = "https://owid.cloudflareaccess.com/cdn-cgi/access/certs";
        $response = file_get_contents($certsUrl);
        $certs = json_decode($response);
        $publicCert = new Key($certs->public_cert->cert);
        $audTag = getenv('CLOUDFLARE_AUD');

        // Verify the JWT token
        $token = (new Parser())->parse((string) $jwt);
        $signer = new Sha256();
        $token->verify($signer, $publicCert);

        $user = get_user_by('email', $token->getClaim('email'));
        if (!$user) {
            wp_die('User not found. Please contact an administrator.');
        }
        return $user;
    } else {
        return null;
    }
}

add_action('login_init', function () {
    add_filter('authenticate', __NAMESPACE__ . '\auth_cloudflare_sso', 10, 3);
    $user = wp_signon();
    if ($user instanceof \WP_User) {
        wp_set_current_user($user->data->ID, $user->data->user_login);
        // HACK: reauth is set to 1 when the auth cookies are invalid or expired
        // (e.g. refreshing the admin panel with expired or missing cookies),
        // thus leading to clearing them in wp-login.php. In our case, it is
        // possible that reauth=1, and yet auth cookies are valid as we just set
        // them. This will prevent clearing the auth cookies we just set, which
        // would lead to an infinite redirection loop.
        $_REQUEST['reauth'] = 0;
        wp_redirect(get_admin_url());
    }
});
