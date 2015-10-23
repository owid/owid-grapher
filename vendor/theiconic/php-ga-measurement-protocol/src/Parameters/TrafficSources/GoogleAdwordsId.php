<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\TrafficSources;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class GoogleAdwordsId
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#gclid
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\TrafficSources
 */
class GoogleAdwordsId extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'gclid';
}
