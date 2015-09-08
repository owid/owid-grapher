<?php namespace Zofe\Rapyd;

use Illuminate\Html\FormBuilder;
use Illuminate\Html\HtmlBuilder;
use Illuminate\Support\ServiceProvider;

class RapydServiceProvider extends ServiceProvider
{
    /**
     * Bootstrap the application events.
     *
     * @return void
     */
    public function boot()
    {
        $this->loadViewsFrom(__DIR__.'/../views', 'rapyd');
        $this->loadTranslationsFrom(__DIR__.'/../lang', 'rapyd');
        
        $this->publishes([
            __DIR__.'/../public/assets' => public_path('packages/zofe/rapyd/assets')
        ], 'assets');
        
        $this->publishes([
            __DIR__.'/../config/rapyd.php' => config_path('rapyd.php'),
        ], 'config');
        
        $this->publishes([
            __DIR__.'/routes.php' => app_path('/Http/rapyd.php'),
        ], 'routes');

        $this->mergeConfigFrom(
            __DIR__.'/../config/rapyd.php', 'rapyd'
        );

        if (file_exists($file = app_path('/Http/rapyd.php')))
        {
            include $file;
        } else {
            include __DIR__ . '/routes.php';
        }
       
        include __DIR__ . '/macro.php';
    }

    /**
     * Register the service provider.
     *
     * @return void
     */
    public function register()
    {
        $this->app->register('Illuminate\Html\HtmlServiceProvider');
        $this->app->register('Zofe\Burp\BurpServiceProvider');
        
        Rapyd::setContainer($this->app);
   
        $this->app->booting(function () {
            $loader  =  \Illuminate\Foundation\AliasLoader::getInstance();
            
            $loader->alias('Rapyd'     , 'Zofe\Rapyd\Facades\Rapyd'     );
            
            //deprecated .. and more facade are really needed ?
            $loader->alias('DataSet'   , 'Zofe\Rapyd\Facades\DataSet'   );
            $loader->alias('DataGrid'  , 'Zofe\Rapyd\Facades\DataGrid'  );
            $loader->alias('DataForm'  , 'Zofe\Rapyd\Facades\DataForm'  );
            $loader->alias('DataEdit'  , 'Zofe\Rapyd\Facades\DataEdit'  );
            $loader->alias('DataFilter', 'Zofe\Rapyd\Facades\DataFilter');
            $loader->alias('Documenter', 'Zofe\Rapyd\Facades\Documenter');
        });
    }

    /**
     * Get the services provided by the provider.
     *
     * @return array
     */
    public function provides()
    {
        return [];
    }
    
}
