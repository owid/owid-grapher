<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\SocialInteractions;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class SocialNetwork
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#sn
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\SocialInteractions
 */
class SocialNetwork extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'sn';
}
