<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce;

use TheIconic\Tracking\GoogleAnalytics\Parameters\CompoundParameterCollection;

/**
 * Class ProductImpressionCollection
 *
 * Represents a collection of Product Impressions. Product data sent on the payload have a "il<index>pi" prefix.
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#enhanced-ecomm
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce
 */
class ProductImpressionCollection extends CompoundParameterCollection
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'il:i:pi';
}
