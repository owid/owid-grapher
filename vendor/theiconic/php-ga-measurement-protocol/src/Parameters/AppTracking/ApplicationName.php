<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\AppTracking;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ApplicationName
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#an
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\AppTracking
 */
class ApplicationName extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'an';
}
