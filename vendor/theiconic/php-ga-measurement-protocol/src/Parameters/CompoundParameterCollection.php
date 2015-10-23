<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters;

use TheIconic\Tracking\GoogleAnalytics\Traits\Indexable;
use IteratorAggregate;

/**
 * Class CompoundParameterCollection
 *
 * Contains a set of compound parameters. The name of the collection is prepend before the compound parameter
 * names. The name can be indexed by the placeholder as specified in the Indexable trait.
 *
 * @package TheIconic\Tracking\GoogleAnalytics\Parameters
 */
abstract class CompoundParameterCollection implements IteratorAggregate
{
    use Indexable;

    /**
     * Name for the collection of compound parameters. Its prepend to the payload names
     * of the compound parameter.
     *
     * @var string
     */
    protected $name = '';

    /**
     * Holds all the compound parameters that belong to the collection.
     *
     * @var CompoundParameter[]
     */
    protected $items = [];

    /**
     * Indexes the name in case it has a placeholder.
     *
     * @param string $index
     */
    public function __construct($index = '')
    {
        $this->name = $this->addIndex($this->name, $index);
    }

    /**
     * @inheritDoc
     */
    public function add(CompoundParameter $compoundParameter)
    {
        $this->items[] = $compoundParameter;
    }

    /**
     * @inheritDoc
     */
    public function getParametersArray()
    {
        $parameters = [];

        foreach ($this as $number => $compoundParameter) {
            $currentParameters = [];

            foreach ($compoundParameter->getParameters() as $name => $value) {
                $currentParameters[$this->name . ($number + 1) . $name] = $value;
            }

            $parameters = array_merge($parameters, $currentParameters);
        }

        return $parameters;
    }

    /**
     * @inheritDoc
     */
    public function getIterator()
    {
        return new \ArrayIterator($this->items);
    }
}
