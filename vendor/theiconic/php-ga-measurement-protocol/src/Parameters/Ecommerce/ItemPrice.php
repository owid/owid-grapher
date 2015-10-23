<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Ecommerce;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ItemPrice
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#ip
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Ecommerce
 */
class ItemPrice extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'ip';
}
