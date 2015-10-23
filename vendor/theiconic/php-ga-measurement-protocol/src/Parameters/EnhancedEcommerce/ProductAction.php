<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ProductAction
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#pa
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\EnhancedEcommerce
 */
class ProductAction extends SingleParameter
{
    /**
     * Value for product action detail.
     */
    const ACTION_DETAIL = 'detail';

    /**
     * Value for product action click.
     */
    const ACTION_CLICK = 'click';

    /**
     * Value for product action add.
     */
    const ACTION_ADD = 'add';

    /**
     * Value for product action remove.
     */
    const ACTION_REMOVE = 'remove';

    /**
     * Value for product action checkout.
     */
    const ACTION_CHECKOUT = 'checkout';

    /**
     * Value for product action checkout option.
     */
    const ACTION_CHECKOUTOPTION = 'checkout_option';

    /**
     * Value for product action purchase.
     */
    const ACTION_PURCHASE = 'purchase';

    /**
     * Value for product action refund.
     */
    const ACTION_REFUND = 'refund';

    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'pa';
}
