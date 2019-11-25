<?php

namespace OWID\blocks\additional_information;

function render($attributes, $content)
{
  $title = $attributes['title'];

  $block = <<<EOD
	<block type="additional-information">
		<attributes>
			<title>$title</title>
		</attributes>
		<content>$content</content>
	</block>
EOD;

  return $block;
}
