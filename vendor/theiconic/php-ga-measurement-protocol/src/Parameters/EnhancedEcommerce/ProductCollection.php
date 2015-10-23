<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce;

use TheIconic\Tracking\GoogleAnalytics\Parameters\CompoundParameterCollection;

/**
 * Class ProductCollection
 *
 * Represents a collection of Products. Product data sent on the payload have a "pr" prefix.
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#enhanced-ecomm
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce
 */
class ProductCollection extends CompoundParameterCollection
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'pr';
}
