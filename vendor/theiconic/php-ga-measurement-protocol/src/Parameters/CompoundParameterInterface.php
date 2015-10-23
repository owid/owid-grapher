<?php

namespace TheIconic\Tracking\GoogleAnalytics\Parameters;

interface CompoundParameterInterface
{
    /**
     * Gets the payload parameters and their values.
     *
     * @return array
     */
    public function getParameters();
}
