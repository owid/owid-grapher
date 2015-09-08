<?php

Illuminate\Html\FormFacade::macro('field', function ($field) {
    $form = Rapyd::getForm();
    if ($form) return $form->field($field);
});
