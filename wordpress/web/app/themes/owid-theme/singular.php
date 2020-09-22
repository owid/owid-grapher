<?php
// Redirect from admin site for live urls
// if (!is_preview()) {
// 	$url = "https://ourworldindata.org" . $_SERVER['REQUEST_URI'];
// 	wp_redirect($url, 302);
// 	exit;
// }

$ID = get_the_ID();
wp_redirect("/admin/posts/preview/$ID", 302);
exit();
?>
