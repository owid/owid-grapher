<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\TrafficSources;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class DocumentReferrer
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#dr
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\TrafficSources
 */
class DocumentReferrer extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'dr';
}
