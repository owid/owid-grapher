<?php
// Run this script as a logged-in user otherwise the revisions are created with author "O"
// If using wp eval-file, pass "--user=[USER_ID]" flag
?>

<?php

function get_post_admin_links($post)
{
  $name = $post->post_title;
  $view = "https://staging.owid.cloud/admin/posts/preview/$post->ID";
  $edit = "https://staging.owid.cloud/wp/wp-admin/post.php?post=$post->ID&action=edit";
  // $view = "http://localhost:3099/$post->post_name";
  // $edit = "http://our-world-in-data.lndo.site/wp/wp-admin/post.php?post=$post->ID&action=edit";

  return "$name;$view;$edit";
}

function should_be_wpautop_formatted($post)
{
  $raw_posts_id = array(92, 6800, 22815, 22821, 22831, 23431, 19485, 22626, 22636, 27763);
  if (!in_array($post->ID, $raw_posts_id)) {
    $matches = array();
    $count = preg_match_all("/<!-- wp:([\S]+)/", $post->post_content, $matches);
    if ($count === 0 || ($count === 1 && $matches[1][0] === 'html')) {
      if ($count === 1) {
        echo "Applying wpautop to Gutenberg post: $post->post_title (reason: contains only one wp:html block)\n";
      }
      return true;
    } else {
      return false;
    }
  }
}

function owid_commit_wpautop_to_db()
{
  $posts = get_posts(array('post_type' => ['post', 'page'], 'numberposts' => -1));

  foreach ($posts as $post) {
    $content = $post->post_content;

    if (should_be_wpautop_formatted($post)) {
      $patterns = array("/\r\n/", "/\n+/", "/\n/");
      $replacements = array("\n", "\n", "\n\n");
      $content = preg_replace($patterns, $replacements, $content);

      $content = wpautop($content);
      echo get_post_admin_links($post) . "\n";
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
}

owid_commit_wpautop_to_db();
