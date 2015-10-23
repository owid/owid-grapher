<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce;

use TheIconic\Tracking\GoogleAnalytics\Parameters\CompoundParameter;

/**
 * Class Product
 *
 * Represents the product to be added to the google analytics hit.
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#enhanced-ecomm
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce
 */
class Product extends CompoundParameter
{
    /**
     * Key/value pair associative array that maches product fields with google analytics parameter name.
     *
     * @var array
     */
    protected $parameterNameMapper = [
        '/^sku$/' => 'id',
        '/^name$/' => 'nm',
        '/^brand$/' => 'br',
        '/^category$/' => 'ca',
        '/^variant$/' => 'va',
        '/^price$/' => 'pr',
        '/^coupon_code$/' => 'cc',
        '/^position$/' => 'ps',
        '/^quantity$/' => 'qt',
        '/^custom_dimension_(\d{1,3})$/' => 'cd',
        '/^custom_metric_(\d{1,3})$/' => 'cm',
    ];

    protected $requiredParameters = ['sku', 'name'];
}
