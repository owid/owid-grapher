<?php

namespace TheIconic\Tracking\GoogleAnalytics\Exception;

/**
 * Class InvalidPayloadDataException
 *
 * Thrown when a hit is tried to be sent and the minimum requirements for parameters are not met.
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Exception
 */
class InvalidPayloadDataException extends \Exception
{
    /**
     * @var string
     */
    protected $message =
        'Minimum required parameters not met for payload data, the following must be set: ProtocolVersion, TrackingId and ClientId';
}
