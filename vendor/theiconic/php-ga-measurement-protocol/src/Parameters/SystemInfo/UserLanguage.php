<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\SystemInfo;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class UserLanguage
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#ul
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\SystemInfo
 */
class UserLanguage extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'ul';
}
