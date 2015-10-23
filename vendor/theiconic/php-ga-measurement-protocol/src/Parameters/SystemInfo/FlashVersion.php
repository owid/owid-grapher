<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\SystemInfo;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class FlashVersion
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#fl
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\SystemInfo
 */
class FlashVersion extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'fl';
}
