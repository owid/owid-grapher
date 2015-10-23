<?php


namespace TheIconic\Tracking\GoogleAnalytics\Parameters;


interface CompoundParameterCollectionInterface
{
    /**
     * Adds a compound parameter to the collection.
     *
     * @param CompoundParameter $compoundParameter
     */
    public function add(CompoundParameter $compoundParameter);

    /**
     * Generates and returns all the payload parameters of compound parameters hold by the collection.
     *
     * @return array
     */
    public function getParametersArray();
}
