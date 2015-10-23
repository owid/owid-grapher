<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Session;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class GeographicalOverride
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#geoid
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Session
 */
class GeographicalOverride extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'geoid';
}
