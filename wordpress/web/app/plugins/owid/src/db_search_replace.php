<?php
// Run this script as a logged-in user otherwise the revisions are created with author "O"
// If using wp eval-file, pass "--user=[USER_ID]" flag
// e.g. $ lando wp eval-file --user=35 /path/to/script.php
//
// Check out the following commits for examples:
// - format_wpautop.php 4b70d7557fb31882e63957777a72a62d6906e0ec
// - h5_to_h4.php 5b5b7b1e9caa2c631a4684506525618730088143
// - remove_has_2_columns.php 042355f7fc8d3aab663656e7259f71446e9eb7f2
?>

<?php
function get_post_admin_links($post)
{
    $name = $post->post_title;
    $view = "https://ourworldindata.org/$post->post_name";
    $preview = "https://owid.cloud/admin/posts/preview/$post->ID";
    $edit = "https://owid.cloud/wp/wp-admin/post.php?post=$post->ID&action=edit";
    // $view = "http://localhost:3099/$post->post_name";
    // $edit = "http://owid.lndo.site/wp/wp-admin/post.php?post=$post->ID&action=edit";

    return "$name ; $view ; $preview ; $edit";
}

$posts = get_posts([
    'post_type' => ['post'],
    'numberposts' => -1,
]); //, 'include' => array(26199, 596)));

foreach ($posts as $post) {
    $content = $post->post_content;

    $status = update_post_meta(
        $post->ID,
        "owid_publication_context_meta_field",
        [
            "immediate_newsletter" => true,
            "homepage" => true,
            "latest" => true,
        ]
    );

    if ($status == true) {
        echo get_post_admin_links($post) . "\n";

        // IMPORTANT: comment out post_updated hook in owid.php before uncommenting this (DB will crash otherwise)
        // wp_update_post($my_post);
    }
}

