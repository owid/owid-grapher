<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce;

use TheIconic\Tracking\GoogleAnalytics\Parameters\CompoundParameterCollection;

/**
 * Class PromotionCollection
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#enhanced-ecomm
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce
 */
class PromotionCollection extends CompoundParameterCollection
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'promo';
}
