<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\CustomDimensionsMetrics;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class CustomDimension
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#cd_
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\CustomDimensionsMetrics
 */
class CustomDimension extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'cd:i:';
}
