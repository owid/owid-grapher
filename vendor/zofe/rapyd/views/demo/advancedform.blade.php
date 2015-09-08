@extends('rapyd::demo.demo')

@section('title','DataForm')

@section('body')

    @include('rapyd::demo.menu_form')

    <h1>DataForm (advanced stuffs)</h1>
    <p>
        Samples of autocomplete feature (in development).<br />
        All use <a href="http://twitter.github.io/typeahead.js/" target="_blank">twitter typehaead</a> and
        <a href="http://twitter.github.io/typeahead.js/examples/#bloodhound" target="_blank">Bloodhound (Suggestion Engine)</a>.<br />
        The last one also uses <a href="https://github.com/TimSchlechter/bootstrap-tagsinput" target="_blank">TagsInput</a>.
        <br />

        <ul>
         <li>The most simple is the first one, it simply builds a local json array using <strong>options()</strong></li>
         <li>The second one is the smarter, using relation.fieldname as fieldname and <strong>search(array of search fields)</strong><br />
             rapyd will manage an ajax request to instace a related entity, search on search fields, and store the foreign key on select
         </li>
         <li>The third is the more complete, it is like the second one with the added ability to customize the search query </li>
         <li>The last is a sample of the "tags" field to manage a belongsToMany and it also supports search() and remote()</li>

        </ul>

        <br />
        The only options available in this demo are "Jane" and "Jhon", it is just a test form to show it works properly.<br />
        In the same spirit, the only categories available are "Category 1" up to "Category 5".
    </p>
    <p>

        {!! $form !!}
        {!! Documenter::showMethod("Zofe\\Rapyd\\Demo\\DemoController", array("anyAdvancedform", "getAuthorlist")) !!}
    </p>
@stop
