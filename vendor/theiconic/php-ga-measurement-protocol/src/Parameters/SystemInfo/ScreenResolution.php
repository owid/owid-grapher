<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\SystemInfo;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ScreenResolution
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#sr
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\SystemInfo
 */
class ScreenResolution extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'sr';
}
