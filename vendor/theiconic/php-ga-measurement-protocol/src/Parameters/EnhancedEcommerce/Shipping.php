<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class Shipping
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#ts
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce
 */
class Shipping extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'ts';
}
