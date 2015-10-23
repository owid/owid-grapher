<?php

namespace TheIconic\Tracking\GoogleAnalytics\Exception;

/**
 * Class InvalidCompoundParameterException
 *
 * Thrown when an invalid compound parameter is tried to be instantiated.
 * To be considered valid, a compound parameter must have a collection prefix attribute.
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Exception
 */
class InvalidCompoundParameterException extends \Exception
{
}
