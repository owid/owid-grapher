<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\CustomDimensionsMetrics;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class CustomMetric
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#cm_
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\CustomDimensionsMetrics
 */
class CustomMetric extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'cm:i:';
}
