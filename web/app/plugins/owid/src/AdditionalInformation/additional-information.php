<?php

namespace OWID\blocks\additional_information;

function render($attributes, $content)
{
	$title = $attributes['title'] ? $attributes['title'] : 'Additional information';

	$figure = null;
	if (!empty($attributes['mediaUrl'])) {
		$figure = '<figure>' . wp_get_attachment_image($attributes['mediaId'], 'medium_large') . '</figure>';
	}

	$block = <<<EOD
	<block type="additional-information">
		<attributes>
			<title>$title</title>
			$figure
		</attributes>
		<content>$content</content>
	</block>
EOD;

	return $block;
}
