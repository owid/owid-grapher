<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\User;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class UserId
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#uid
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\User
 */
class UserId extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'uid';
}
