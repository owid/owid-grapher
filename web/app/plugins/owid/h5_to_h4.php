<?php
// Run this script as a logged-in user otherwise the revisions are created with author "O"
// If using wp eval-file, pass "--user=[USER_ID]" flag
//
// Check out 4b70d7557fb31882e63957777a72a62d6906e0ec for another instance of this one-off script
?>

<?php

function get_post_admin_links($post)
{
  $name = $post->post_title;
  $view = "https://ourworldindata.org/$post->post_name";
  $preview = "https://owid.cloud/admin/posts/preview/$post->ID";
  $edit = "https://owid.cloud/wp/wp-admin/post.php?post=$post->ID&action=edit";
  // $view = "http://localhost:3099/$post->post_name";
  // $edit = "http://our-world-in-data.lndo.site/wp/wp-admin/post.php?post=$post->ID&action=edit";

  return "$name;$view;$preview;$edit";
}

function owid_h5_to_h4()
{
  $posts = get_posts(array('post_type' => ['post', 'page'], 'numberposts' => -1)); //, 'include' => array(26199, 596)));

  foreach ($posts as $post) {
    $content = $post->post_content;

    // $patterns = array("/\r\n/", "/\n+/", "/\n/");
    // $patterns = $replacements = null

    $patterns = array(
      "/<hr class=\"datasources-hr\" \/>/", // classic
      "/\n<!-- wp:separator {\"className\":\"datasources-hr\"} -->\n<hr class=\"wp-block-separator datasources-hr\"\/>\n<!-- \/wp:separator -->/", //gutenberg
      "/<h5>/", // classic, gutenberg
      "/<\/h5>/", // classic, gutenberg
      "/<!-- wp:heading {\"level\":5} -->/" // gutenberg
    );
    $replacements = array("", "", "<h4>", "</h4>", "<!-- wp:heading {\"level\":4} -->");

    $nb_replacements = 0;
    $content = preg_replace($patterns, $replacements, $content, -1, $nb_replacements);

    if ($nb_replacements !== 0) echo get_post_admin_links($post) . "\n";

    $my_post = array(
      'ID'           => $post->ID,
      'post_content' => $content,
    );
    wp_update_post($my_post);
    // $post_id = wp_update_post($my_post, true);
    // if (is_wp_error($post_id)) {
    //   $errors = $post_id->get_error_messages();
    //   foreach ($errors as $error) {
    //     echo $error;
    //   }
    // }
  }
}

owid_h5_to_h4();
