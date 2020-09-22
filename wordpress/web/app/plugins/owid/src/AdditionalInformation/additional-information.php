<?php

namespace OWID\blocks\additional_information;

function render($attributes, $content)
{
    $default_open =
        isset($attributes['defaultOpen']) && $attributes['defaultOpen']
            ? "true"
            : "false";
    $block = <<<EOD
	<block type="additional-information" default-open="$default_open">
		<content>$content</content>
	</block>
EOD;

    return $block;
}
