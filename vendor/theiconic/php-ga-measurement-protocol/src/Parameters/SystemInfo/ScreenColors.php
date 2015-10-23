<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\SystemInfo;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ScreenColors
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#sd
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\SystemInfo
 */
class ScreenColors extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'sd';
}
