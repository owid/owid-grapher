<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\ContentExperiments;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ExperimentId
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#xid
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\ContentExperiments
 */
class ExperimentId extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'xid';
}
