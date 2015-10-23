<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\AppTracking;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ApplicationId
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#aid
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\AppTracking
 */
class ApplicationId extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'aid';
}
