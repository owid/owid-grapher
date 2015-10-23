<?php

namespace Irazasyed\LaravelGAMP;

/*
 * Laravel GAMP: Google Analytics - Measurement Protocol
 *
 * NOTICE OF LICENSE
 *
 * Licensed under the MIT License.
 *
 * This source file is subject to the MIT  License that is
 * bundled with this package in the LICENSE file.  It is also available at
 * the following URL: http://opensource.org/licenses/MIT
 *
 * @package       LaravelGAMP
 * @author        Lukonet
 * @license       MIT
 * @copyright (c) 2015 Lukonet Pvt. Ltd.
 * @link          https://lukonet.com
 */

use Illuminate\Support\ServiceProvider;
use TheIconic\Tracking\GoogleAnalytics\Analytics;

class LaravelGAMPServiceProvider extends ServiceProvider
{
    /**
     * Indicates if loading of the provider is deferred.
     *
     * @var bool
     */
    protected $defer = true;

    /**
     * Holds path to Config File.
     *
     * @var string
     */
    protected $config_filepath;

    /**
     * Bootstrap the application events.
     */
    public function boot()
    {
        $this->publishes([
            $this->config_filepath => config_path('gamp.php'),
        ]);
    }

    /**
     * Register the service provider.
     */
    public function register()
    {
        $this->registerAnalytics();

        $this->config_filepath = __DIR__.'/config/gamp.php';

        $this->mergeConfigFrom($this->config_filepath, 'gamp');
    }

    /**
     * Initialize Analytics Library with Default Config.
     */
    public function registerAnalytics()
    {
        $this->app->singleton('gamp', function ($app) {
            $config = $app['config'];

            $analytics = new Analytics($config->get('gamp.is_ssl', false));

            $analytics->setProtocolVersion($config->get('gamp.protocol_version', 1))
                ->setTrackingId($config->get('gamp.tracking_id'));

            if ($config->get('gamp.anonymize_ip', false)) {
                $analytics->setAnonymizeIp('1');
            }

            if ($config->get('gamp.async_requests', false)) {
                $analytics->setAsyncRequest(true);
            }

            return $analytics;
        });
    }

    /**
     * Get the services provided by the provider.
     *
     * @return array
     */
    public function provides()
    {
        return ['gamp'];
    }
}
