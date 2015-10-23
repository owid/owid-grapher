<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\Hit;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class HitType
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#t
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\Hit
 */
class HitType extends SingleParameter
{
    /**
     * Value sent when tracking a page view by an user.
     *
     * @link https://developers.google.com/analytics/devguides/collection/analyticsjs/pages
     */
    const HIT_TYPE_PAGEVIEW = 'pageview';

    /**
     * Value sent when tracking a user event.
     *
     * @link https://developers.google.com/analytics/devguides/collection/analyticsjs/events
     */
    const HIT_TYPE_EVENT = 'event';

    /**
     * Value sent when tracking a mobile app screen view.
     *
     * @link https://developers.google.com/analytics/devguides/collection/analyticsjs/screens
     */
    const HIT_TYPE_SCREENVIEW = 'screenview';

    /**
     * Value sent when reporting a transaction with the old Ecommerce events.
     * It should not be used with Enhanced Ecommerce.
     *
     * @link https://developers.google.com/analytics/devguides/collection/analyticsjs/ecommerce
     */
    const HIT_TYPE_TRANSACTION = 'transaction';

    /**
     * Value sent when reporting an item add to cart with the old Ecommerce events.
     * It should not be used with Enhanced Ecommerce.
     *
     * @link https://developers.google.com/analytics/devguides/collection/analyticsjs/ecommerce
     */
    const HIT_TYPE_ITEM = 'item';

    /**
     * Value sent when reporting a social event.
     *
     * @link https://developers.google.com/analytics/devguides/collection/analyticsjs/social-interactions
     */
    const HIT_TYPE_SOCIAL = 'social';

    /**
     * Value sent when reporting an exception on the page.
     *
     * @link https://developers.google.com/analytics/devguides/collection/analyticsjs/exceptions
     */
    const HIT_TYPE_EXCEPTION = 'exception';

    /**
     * Value sent when reporting loading time from the user with timing tracking.
     *
     * @link https://developers.google.com/analytics/devguides/collection/analyticsjs/user-timings
     */
    const HIT_TYPE_TIMING = 'timing';

    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 't';
}
