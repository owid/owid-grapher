<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\ContentInformation;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class DocumentLocationUrl
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#dl
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\ContentInformation
 */
class DocumentLocationUrl extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'dl';
}
