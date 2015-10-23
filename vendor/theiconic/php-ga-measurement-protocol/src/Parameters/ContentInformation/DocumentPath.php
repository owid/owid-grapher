<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters\ContentInformation;

use TheIconic\Tracking\GoogleAnalytics\Parameters\SingleParameter;

/**
 * Class DocumentPath
 *
 * @link https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#dp
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters\ContentInformation
 */
class DocumentPath extends SingleParameter
{
    /**
     * @inheritDoc
     *
     * @var string
     */
    protected $name = 'dp';
}
