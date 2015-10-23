<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\AppTracking;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ApplicationInstallerId
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#aiid
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\AppTracking
 */
class ApplicationInstallerId extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'aiid';
}
