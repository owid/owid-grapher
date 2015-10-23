<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class PromotionAction
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#promoa
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce
 */
class PromotionAction extends SingleParameter
{
    /**
     * Value for click action.
     */
    const ACTION_CLICK = 'click';

    /**
     * Value for view action.
     */
    const ACTION_VIEW = 'view';

    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'promoa';
}
