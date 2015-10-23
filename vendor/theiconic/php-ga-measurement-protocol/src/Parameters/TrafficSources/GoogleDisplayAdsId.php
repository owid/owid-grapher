<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\TrafficSources;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class GoogleDisplayAdsId
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#dclid
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\TrafficSources
 */
class GoogleDisplayAdsId extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'dclid';
}
