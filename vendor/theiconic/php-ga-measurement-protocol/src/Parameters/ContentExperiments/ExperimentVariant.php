<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\ContentExperiments;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ExperimentVariant
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#xvar
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\ContentExperiments
 */
class ExperimentVariant extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'xvar';
}
