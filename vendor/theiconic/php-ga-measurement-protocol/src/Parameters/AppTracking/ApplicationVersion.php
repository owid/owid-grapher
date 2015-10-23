<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\AppTracking;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ApplicationVersion
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#av
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\AppTracking
 */
class ApplicationVersion extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'av';
}
