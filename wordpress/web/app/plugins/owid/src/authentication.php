<?php

namespace OWID;

use Lcobucci\JWT\Parser;
use Lcobucci\JWT\Signer\Key;
use Lcobucci\JWT\Signer\Rsa\Sha256;
use Lcobucci\JWT\ValidationData;

const CLOUDFLARE_COOKIE_NAME = "CF_Authorization";
/*
 * Attempts to find a valid user within the JWT, after verifying and validating
 * it. If successful, the user is automatically signed in, through SSO.
 *
 * Errors happening during the authorization flow are silently logged. The
 * standard log-in form is then displayed as a fallback.
 */
function auth_cloudflare_sso($user, $username, $password)
{
    $jwt_cookie = $_COOKIE[CLOUDFLARE_COOKIE_NAME] ?? null;
    // If the cookie is present, it means that route is being protected by
    // Cloudflare Access.
    if (!$jwt_cookie) {
        // No errors logged here as this can be a legitimate situation, e.g.
        // when working locally.
        return;
    }

    $audTag = getenv('CLOUDFLARE_AUD');
    if (empty($audTag)) {
        error_log(
            "Missing or empty audience tag. Please add CLOUDFLARE_AUD key in .env."
        );
        return;
    }

    $token = (new Parser())->parse((string) $jwt_cookie);

    // Verify the JWT
    $certsUrl = "https://owid.cloudflareaccess.com/cdn-cgi/access/certs";
    $response = file_get_contents($certsUrl);
    $certs = json_decode($response);
    $publicCert = $certs->public_cert->cert;
    if (empty($publicCert)) {
        error_log(
            "Missing public certificate from Cloudflare."
        );
        return;
    }

    $key = new Key($publicCert);
    $signer = new Sha256();
    if (!$token->verify($signer, $key)) {
        error_log("Token verification failed.");
        return;
    }

    // Validate JWT claims
    $data = new ValidationData();
    if (!$token->validate($data)) {
        error_log("Authorization token invalid: token expired.");
        return;
    }
    // Ideally, we should be able to validate after setting $data->setAudience($audTag)
    // but this fails, probably due to the fact that CF sets the audience as an array.
    if ($token->getClaim('aud')[0] !== $audTag) {
        error_log("Authorization token invalid: wrong audience.");
        return;
    }
    $user = get_user_by('email', $token->getClaim('email'));
    if (!$user) {
        // This error will be shown to the user. We won't show the fallback
        // log-in form here as attempting to log in with the same user will
        // trigger a similar error (since the user does not exist).
        wp_die('User not found. Please contact an administrator.');
    }

    return $user;
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
        // them (again) through an automatic log in.
        // This prevents clearing the auth cookies we just set, which
        // would lead to an infinite redirection loop.
        $_REQUEST['reauth'] = 0;
        wp_redirect(admin_url());
    }
});

add_action('wp_logout', function () {
    // This is just some standard browser cleanup. It does not log out of
    // Cloudflare. When WP attempts to log out, auth_cloudflare_sso() will try
    // to log back in. If the JWT stored in the cookie is still valid, then the
    // user will be redirected to the admin (even though the logout button was
    // clicked). This is why a short token validity is required.
    unset($_COOKIE[CLOUDFLARE_COOKIE_NAME]);
    setcookie(CLOUDFLARE_COOKIE_NAME, "", time() - 3600, '/');
});

/*
 * Since the logout URL is identical to the login URL (plus an ?action=logout
 * query parameter), it is protected by Cloudflare. Logging out then prompts the
 * user to log in, which we don't want. This filter changes the logout URL to
 * point it to a custom page, where the logout is performed.
 * custom page.
 */
add_filter(
    'logout_url',
    function () {
        $logout_url = wp_nonce_url(plugins_url('logout.php', __FILE__), 'log-out');
        return $logout_url;
    },
    10,
    0

);
