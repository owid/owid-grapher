<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters;

use TheIconic\Tracking\GoogleAnalytics\Exception\InvalidCompoundParameterException;

/**
 * Class CompoundParameter
 *
 * A compound parameter represents a set of parameters that are part of a collection.
 * There is a parameter name mapper that maps a human readable name that is used for passing the data
 * into the real name that goes in the payload.
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters
 */
abstract class CompoundParameter implements CompoundParameterInterface
{
    /**
     * Maps a human readable name used when initializing the compound parameter into
     * the real name used in the payload.
     *
     * @var array
     */
    protected $parameterNameMapper = [];

    /**
     * Contains the required parameters for the compound parameters.
     * They are in the same human readable name as in the mapper above.
     *
     * @var array
     */
    protected $requiredParameters = [];

    /**
     * After translating the human readable names into the payload ones, this collections
     * contains the map for the payload names and the values to be sent.
     *
     * @var array
     */
    protected $parameters = [];


    /**
     * Validates the required parameters are passed, then translates using the mapper to later save
     * along with the values.
     *
     * @param array $compoundData
     *
     * @throws InvalidCompoundParameterException
     */
    public function __construct(array $compoundData)
    {
        foreach ($this->requiredParameters as $requiredParameter) {
            if (!array_key_exists($requiredParameter, $compoundData)) {
                throw new InvalidCompoundParameterException(
                    $requiredParameter . ' is required for ' . get_class($this)
                );
            }
        }

        $this->saveCompoundParameterData($compoundData);
    }

    /**
     * @inheritDoc
     */
    public function getParameters()
    {
        return $this->parameters;
    }

    /**
     * Translates the human readable names into the payload ones and saves them along with the values.
     *
     * @param array $compoundData
     * @throws \InvalidArgumentException
     */
    protected function saveCompoundParameterData(array $compoundData)
    {
        foreach ($compoundData as $name => $value) {
            $matchExists = false;
            foreach ($this->parameterNameMapper as $regex => $parameterName) {
                if (preg_match($regex, $name, $matches) === 1) {
                    $parameterLastIndex = '';

                    if (isset($matches[1])) {
                        $parameterLastIndex = $matches[1];
                    }

                    $matchExists = true;
                    $this->parameters[$parameterName . $parameterLastIndex] = $value;

                    break;
                }
            }

            if (!$matchExists) {
                throw new \InvalidArgumentException("Unknown parameter $name for " . get_class($this) . ' data');
            }
        }
    }
}
