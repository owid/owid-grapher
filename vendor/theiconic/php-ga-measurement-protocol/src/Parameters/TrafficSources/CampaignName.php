<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\TrafficSources;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class CampaignName
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#cn
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\TrafficSources
 */
class CampaignName extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'cn';
}
