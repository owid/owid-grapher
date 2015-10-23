<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\User;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class ClientId
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#cid
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\User
 */
class ClientId extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'cid';
}
