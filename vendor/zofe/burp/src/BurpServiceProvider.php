<?php

namespace Zofe\Burp;

use Illuminate\Support\ServiceProvider;

class BurpServiceProvider extends ServiceProvider
{

    /**
     * Indicates if loading of the provider is deferred.
     *
     * @var bool
     */
    protected $defer = false;

    
    public function register()
    {

        $this->app->booting(function () {
            $loader  =  \Illuminate\Foundation\AliasLoader::getInstance();
            $loader->alias('Burp', 'Zofe\Burp\Burp');
            $loader->alias('BurpEvent', 'Zofe\Burp\BurpEvent');

        });

    }

}