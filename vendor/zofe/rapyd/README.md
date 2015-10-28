rapyd-laravel
=============

[![Join the chat at https://gitter.im/zofe/rapyd-laravel](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/zofe/rapyd-laravel?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

<a href="https://packagist.org/packages/zofe/rapyd">
    <img src="http://img.shields.io/packagist/v/zofe/rapyd.svg?style=flat" style="vertical-align: text-top">
</a>
<a href="https://packagist.org/packages/zofe/rapyd">
    <img src="http://img.shields.io/packagist/dt/zofe/rapyd.svg?style=flat" style="vertical-align: text-top">
</a>

This is a pool of presentation and editing widgets (Grids and Forms) for laravel.  
Nothing to "generate", just some classes to let you develop and maintain CRUD backends in few lines of code.  
  
 Main Website: [rapyd.com](http://www.rapyd.com)  
 Demo: [rapyd.com/demo](http://www.rapyd.com/demo)  
 Documentation: [Wiki](https://github.com/zofe/rapyd-laravel/wiki)  
 
![rapyd laravel](https://raw.github.com/zofe/rapyd-laravel/master/public/assets/rapyd-laravel.png)
 
## important notice:

dev-master switched to laravel 5  
if you are on laravel 4 you must use 1.3.* tags (see at bottom)

The Wiki documentation is for Laravel 4 version, but changes are minimal, mainly related to Blade.  
(you should use {!! $widget !!}  instead  {{ $widget }} etc..


## DataGrid

DataGrid extend [DataSet](https://github.com/zofe/rapyd-laravel/wiki/DataSet) to make data-grid output with few lines of fluent code.  
It build a bootstrap striped table, with pagination at bottom and order-by links on table header.
It support also blade syntax, filters, closures etc..

in a controller 

```php
   $grid = DataGrid::source(Article::with('author'));  //same source types of DataSet
   
   $grid->add('title','Title', true); //field name, label, sortable
   $grid->add('author.fullname','author'); //relation.fieldname 
   $grid->add('{{ substr($body,0,20) }}...','Body'); //blade syntax with main field
   $grid->add('{{ $author->firstname }}','Author'); //blade syntax with related field
   $grid->add('body|strip_tags|substr[0,20]','Body'); //filter (similar to twig syntax)
   $grid->add('body','Body')->filter('strip_tags|substr[0,20]'); //another way to filter
   $grid->edit('/articles/edit', 'Edit','modify|delete'); //shortcut to link DataEdit actions
   $grid->link('/articles/edit',"Add New", "TR");  //add button
   $grid->orderBy('article_id','desc'); //default orderby
   $grid->paginate(10); //pagination

   View::make('articles', compact('grid'))

```

in a view you can just write

```php

  #articles.blade.php  
  {{ $grid }} for L4   
  {!! $grid !!} for L5  

```


styling a datagrid

```php
   ...
   $grid->add('title','Title', true)->style("width:100px"); //adding style to th
   $grid->add('body','Body')->attr("class","custom_column"); //adding class to a th
   ...
    //row and cell manipulation via closure
    $grid->row(function ($row) {
       if ($row->cell('public')->value < 1) {
           $row->cell('title')->style("color:Gray");
           $row->style("background-color:#CCFF66");
       }  
    });
    ...
```

datagrid supports also csv output, so it can be used as "report" tool.

```php
   ...
   $grid->add('title','Title');
   $grid->add('body','Body')
   ...
   $grid->buildCSV();  //  force download 
   $grid->buildCSV('export_articles', 'Y-m-d.His');  // force download with custom stamp
   $grid->buildCSV('uploads/filename', 'Y-m-d');  // write on file 
    ...
```



## DataForm

 DataForm is a form builder, you can add fields, rules and buttons.  
 It will build a bootstrap form, on submit it  will check rules and if validation pass it'll store new entity.  

```php
   //start with empty form to create new Article
   $form = DataForm::source(new Article);
   
   //or find a record to update some value
   $form = DataForm::source(Article::find(1));

   //add fields to the form
   $form->add('title','Title', 'text'); //field name, label, type
   $form->add('body','Body', 'textarea')->rule('required'); //validation

   //some enhanced field (images, wysiwyg, autocomplete, etc..):
   $form->add('photo','Photo', 'image')->move('uploads/images/')->preview(80,80);
   $form->add('body','Body', 'redactor'); //wysiwyg editor
   $form->add('author.name','Author','autocomplete')->search(array('firstname','lastname'));
   $form->add('categories.name','Categories','tags'); //tags field
 
   //you can also use now the smart syntax for all fields: 
   $form->text('title','Title'); //field name, label
   $form->textarea('body','Body')->rule('required'); //validation
   ...
 
   $form->submit('Save');
   $form->saved(function() use ($form)
   {
        $form->message("ok record saved");
        $form->link("/another/url","Next Step");
   });

   View::make('article', compact('form'))
```

```php
   #article.blade.php
  {{ $form }}  for L4  
  {!! $form !!}  for L5
```

[DataForm explained](https://github.com/zofe/rapyd-laravel/wiki/DataForm)  

 
### customize form in view

You can directly customize form  using build() in your controller

 ```php
     ...
     $form->build();
     View::make('article', compact('form'))
 ```
 then in the view you can use something like this:
 
```php
   #article.blade.php
    {!! $form->header !!}

        {!! $form->message !!} <br />

        @if(!$form->message)
            <div class="row">
                <div class="col-sm-4">
                     {!! $form->render('title') !!}
                </div>
                <div class="col-sm-8">
                    {!! $form->render('body') !!}
                </div>
            </div> 
            ...
        @endif

    {!! $form->footer !!}
```
[custom form layout explained](https://github.com/zofe/rapyd-laravel/wiki/Custom-Form-Layout)  
[custom form layout demo](http://www.rapyd.com/rapyd-demo/styledform)  


## DataEdit
  DataEdit extends DataForm, it's a full CRUD application for given Entity.  
  It has status (create, modify, show) and actions (insert, update, delete) 
  It detect status by simple query string semantic:


```
  /dataedit/uri                     empty form    to CREATE new records
  /dataedit/uri?show={record_id}    filled output to READ record (without form)
  /dataedit/uri?modify={record_id}  filled form   to UPDATE a record
  /dataedit/uri?delete={record_id}  perform   record DELETE
  ...
```

```php
   //simple crud for Article entity
   $edit = DataEdit::source(new Article);
   $edit->link("article/list","Articles", "TR")->back();
   $edit->add('title','Title', 'text')->rule('required');
   $edit->add('body','Body','textarea')->rule('required');
   $edit->add('author.name','Author','autocomplete')->search(array('firstname','lastname'));
   
   //you can also use now the smart syntax for all fields: 
   $edit->textarea('title','Title'); 
   $edit->autocomplete('author.name','Author')->search(array('firstname','lastname'));
   
   return $edit->view('crud', compact('edit'));

```

```php
   #crud.blade.php
   
  {{ $edit }} for L4   
  {!! $edit !!} for L5
```
[DataEdit explained](https://github.com/zofe/rapyd-laravel/wiki/DataEdit)  


## DataFilter
DataFilter extends DataForm, each field you add and each value you fill in that form is used to build a __where clause__ (by default using 'like' operator).   
It should be used in conjunction with a DataSet or DataGrid to filter results.  


```php
   $filter = DataFilter::source(new Article);
   $filter->attributes(array('class'=>'form-inline'));
   $filter->add('title','Title', 'text');
   $filter->submit('search');
   $filter->reset('reset');
   
   $grid = DataGrid::source($filter);
   $grid->add('nome','Title', true);
   $grid->add('{{ substr($body,0,20) }}...','Body');
   $grid->paginate(10);

   View::make('articles', compact('filter', 'grid'))
```

```php
   # articles.blade
   
   //for L4  
   {{ $filter }}  
   {{ $grid }}  

    //for L5 
   {!! $filter !!}  
   {!! $grid !!}

```

[DataFilter explained](https://github.com/zofe/rapyd-laravel/wiki/DataFilter)  
[Custom layout and custom query scope](http://www.rapyd.com/rapyd-demo/customfilter) 


## Install in Laravel 4.* and 5.0


To `composer.json` add:  
`"zofe/rapyd": "1.3.*"` for Laravel 4, not frequently updated (should be stable)  
`"zofe/rapyd": "2.0.*"` or _dev-master_ for Laravel 5 (kudos to @tiger2wander for PR)


In `app/config/app.php` add:  
`'Zofe\Rapyd\RapydServiceProvider',`

then run: `$ composer update zofe/rapyd`.


## Namespace consideration, Extending etc.

To use widgets you can: 
- just use the global aliases: `\DataGrid::source()...` (please note the '\')
- or import facades:
```php
    use Zofe\Rapyd\Facades\DataSet;
    use Zofe\Rapyd\Facades\DataGrid;
    use Zofe\Rapyd\Facades\DataForm;
    use Zofe\Rapyd\Facades\DataForm;
    use Zofe\Rapyd\Facades\DataEdit;
    ..
    DataGrid::source()... 
```
- or you can extend each class 
```php
    Class MyDataGrid extends Zofe\Rapyd\DataGrid\DataGrid {
    ...
    }
    Class MyDataEdit extends Zofe\Rapyd\DataEdit\DataEdit {
    ...
    }
    ..
    MyDataGrid::source()
```

## Publish & override configuration and assets

You can quickly publish the configuration file (to override something) 
by running the following Artisan command.  

Laravel 4

    $ php artisan config:publish zofe/rapyd  
    $ php artisan asset:publish zofe/rapyd


Laravel 5

    $ php artisan vendor:publish  
    


You need also to add this to your views, to let rapyd add runtime assets:

```html
<head>
...
<link rel="stylesheet" href="//netdna.bootstrapcdn.com/bootstrap/3.2.0/css/bootstrap.min.css">
<script src="http://code.jquery.com/jquery-1.10.1.min.js"></script>
<script src="//netdna.bootstrapcdn.com/bootstrap/3.2.0/js/bootstrap.min.js"></script>

{{ Rapyd::head() }}  for L4   
{!! Rapyd::head() !!}  for L5

</head>
```
note: widget output is in standard with __Boostrap 3+__, and some widget need support of __JQuery 1.9+__
so be sure to include dependencies as above

A better choice is to split css and javascipts and move javascript at bottom, just before body to speedup the page,
you can do this with:

```html
<head>
  ...
<link rel="stylesheet" href="//netdna.bootstrapcdn.com/bootstrap/3.2.0/css/bootstrap.min.css">
{{ Rapyd::styles() }}
</head>
....

    <script src="http://code.jquery.com/jquery-1.10.1.min.js"></script>
    <script src="//netdna.bootstrapcdn.com/bootstrap/3.2.0/js/bootstrap.min.js"></script>
   {{ Rapyd::scripts() }}
</body>
```



## In short

Rapyd use a "widget" approach to make a crud, without "generation".
(this approach is worst in terms of flexibility but fast/rapid in terms of development and maintenance):

_You need to "show" and "edit" record from an entity?_  
Ok so you need a DataGrid and DataEdit.
You can build widgets where you want (even multiple widgets on same route).
An easy way to work with rapyd is:
  * make a route to a controller for each entity you need to manage
  * make the controller with one method for each widget (i.e.: one for a datagrid and one for a dataedit)
  * make an empty view, include bootstrap and display content that rapyd will build for you


Rapyd comes with demo (controller, models, views)  to run it just add:


/app/routes.php  (Laravel 4)
```php
....
Route::controller('rapyd-demo', 'Zofe\\Rapyd\\Controllers\\DemoController');
```
for Laravel 5 the route is already defined, you sould find rapyd routes in `app/Http/rapyd.php`  

then go to:

/rapyd-demo



## License

Rapyd is licensed under the [MIT license](http://opensource.org/licenses/MIT)

If Rapyd saves you time, please __[support Rapyd](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=QJFERQGP4ZB6A)__
