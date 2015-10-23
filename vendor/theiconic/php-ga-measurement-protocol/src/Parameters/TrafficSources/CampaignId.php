<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\TrafficSources;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class CampaignId
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#ci
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\TrafficSources
 */
class CampaignId extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'ci';
}
