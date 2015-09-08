<?php

namespace Zofe\Rapyd\DataFilter;

use Zofe\Rapyd\DataForm\DataForm;
use Zofe\Rapyd\Persistence;
use Illuminate\Html\FormFacade as Form;
use Illuminate\Support\Facades\DB;

class DataFilter extends DataForm
{

    public $cid;
    public $source;
    protected $process_url = '';
    protected $reset_url = '';
    public $attributes = array('class'=>'form-inline');
    /**
     *
     * @var \Illuminate\Database\Query\Builder
     */
    public $query;

    /**
     * @param $source
     *
     * @return static
     */
    public static function source($source = null)
    {
        $ins = new static();
        $ins->source = $source;
        $ins->query = $source;
        if (is_object($source) && (is_a($source, "\Illuminate\Database\Eloquent\Builder") ||
                                  is_a($source, "\Illuminate\Database\Eloquent\Model"))) {
            $ins->model = $source->getModel();
        }
        $ins->cid = $ins->getIdentifier();
        $ins->sniffStatus();
        $ins->sniffAction();

        return $ins;
    }

    protected function table($table)
    {
        $this->query = DB::table($table);

        return $this->query;
    }

    protected function sniffAction()
    {

        $this->reset_url = $this->url->remove('ALL')->append('reset'.$this->cid, 1)->get();
        $this->process_url = $this->url->remove('ALL')->append('search'.$this->cid, 1)->get();

        ///// search /////
        if ($this->url->value('search')) {
            $this->action = "search";

            Persistence::save();
        }
        ///// reset /////
        elseif ($this->url->value("reset")) {
            $this->action = "reset";

            Persistence::clear();
        } else {

            Persistence::clear();
        }
    }

    protected function process()
    {
        $this->method = 'GET';

        //database save
        switch ($this->action) {
            case "search":

                // prepare the WHERE clause
                foreach ($this->fields as $field) {

                    $field->getValue();
                    $field->getNewValue();
                    $value = $field->new_value;

                    //query scope
                    $query_scope = $field->query_scope;
                    if ($query_scope) {

                        if (is_a($query_scope, '\Closure')) {
                            $this->query = $query_scope($this->query, $value);

                        } elseif (isset($this->model) && method_exists($this->model, "scope".$query_scope)) {
                            $query_scope = "scope".$query_scope;
                            $this->query = $this->model->$query_scope($this->query, $value);

                        }
                        continue;
                    }

                    //detect if where should be deep (on relation)
                    $deep_where = false;

                    if (isset($this->model) && $field->relation != null) {
                        $rel_type = get_class($field->relation);
                        if (in_array($rel_type,
                            array('Illuminate\Database\Eloquent\Relations\HasOne',
                                  'Illuminate\Database\Eloquent\Relations\HasMany',
                                  'Illuminate\Database\Eloquent\Relations\BelongsTo',
                                  'Illuminate\Database\Eloquent\Relations\BelongsToMany'

                            )))
                        {
                            if ($rel_type == 'Illuminate\Database\Eloquent\Relations\BelongsTo' and
                                in_array($field->type, array('select', 'radiogroup', 'autocomplete'))){
                                    $deep_where = false;
                            } else {
                                $deep_where = true;
                            }

                        }
                    }
                    
                    if ($value != "" or (is_array($value)  and count($value)) ) {
                        if (strpos($field->name, "_copy") > 0) {
                            $name = substr($field->db_name, 0, strpos($field->db_name, "_copy"));
                        } else {
                            $name = $field->db_name;
                        }

                        //$value = $field->value;

                        if ($deep_where) {
                            //exception for multiple value fields on BelongsToMany
                            if ($rel_type == 'Illuminate\Database\Eloquent\Relations\BelongsToMany' and
                                in_array($field->type, array('tags','checks'))  )
                            {
                                  $values = explode($field->serialization_sep, $value);

                                  if ($field->clause == 'wherein') {
                                      $this->query = $this->query->whereHas($field->rel_name, function ($q) use ($field, $values) {
                                          $q->whereIn($field->rel_fq_key, $values);
                                      });
                                  }

                                  if ($field->clause == 'where') {
                                      foreach ($values as $v) {
                                          $this->query = $this->query->whereHas($field->rel_name, function ($q) use ($field, $v) {
                                              $q->where($field->rel_fq_key,'=', $v);
                                          });
                                      }
                                  }
                                continue;
                            }

                            switch ($field->clause) {
                                case "like":
                                    $this->query = $this->query->whereHas($field->rel_name, function ($q) use ($field, $value) {
                                        $q->where($field->rel_field, 'LIKE', '%' . $value . '%');
                                    });
                                    break;
                                case "orlike":
                                    $this->query = $this->query->orWhereHas($field->rel_name, function ($q) use ($field, $value) {
                                        $q->where($field->rel_field, 'LIKE', '%' . $value . '%');
                                    });
                                    break;
                                case "where":
                                    $this->query = $this->query->whereHas($field->rel_name, function ($q) use ($field, $value) {
                                        $q->where($field->rel_field, $field->operator, $value);
                                    });
                                    break;
                                case "orwhere":
                                    $this->query = $this->query->orWhereHas($field->rel_name, function ($q) use ($field, $value) {
                                        $q->where($field->rel_field, $field->operator, $value);
                                    });
                                    break;
                                case "wherebetween":
                                    $values = explode($field->serialization_sep, $value);
                                    $this->query = $this->query->whereHas($field->rel_name, function ($q) use ($field, $values) {

                                        if ($values[0] != '' and $values[1] == '') {
                                            $q->where($field->rel_field, ">=", $values[0]);
                                        } elseif ($values[0] == '' and $values[1] != '') {
                                            $q->where($field->rel_field, "<=", $values[1]);
                                        } elseif ($values[0] != '' and $values[1] != '') {

                                            //we avoid "whereBetween" because a bug in laravel 4.1
                                            $q->where(
                                                function ($query) use ($field, $values) {
                                                    return $query->where($field->rel_field, ">=", $values[0])
                                                                 ->where($field->rel_field, "<=", $values[1]);
                                                }
                                            );
                                        }

                                    });
                                    break;
                                case "orwherebetween":
                                    $values = explode($field->serialization_sep, $value);
                                    $this->query = $this->query->orWhereHas($field->rel_name, function ($q) use ($field, $values) {

                                        if ($values[0] != '' and $values[1] == '') {
                                            $q->orWhere($field->rel_field, ">=", $values[0]);
                                        } elseif ($values[0] == '' and $values[1] != '') {
                                            $q->orWhere($field->rel_field, "<=", $values[1]);
                                        } elseif ($values[0] != '' and $values[1] != '') {

                                            //we avoid "whereBetween" because a bug in laravel 4.1
                                            $q->orWhere(
                                                function ($query) use ($field, $values) {
                                                    return $query->where($field->rel_field, ">=", $values[0])
                                                                 ->where($field->rel_field, "<=", $values[1]);
                                                }
                                            );
                                        }

                                    });
                                    break;
                            }

                        //not deep, where is on main entity
                        } else {

                            switch ($field->clause) {
                                case "like":
                                    $this->query = $this->query->where($name, 'LIKE', '%' . $value . '%');
                                    break;
                                case "orlike":
                                    $this->query = $this->query->orWhere($name, 'LIKE', '%' . $value . '%');
                                    break;
                                case "where":
                                    $this->query = $this->query->where($name, $field->operator, $value);
                                    break;
                                case "orwhere":
                                    $this->query = $this->query->orWhere($name, $field->operator, $value);
                                    break;
                                case "wherebetween":
                                    $values = explode($field->serialization_sep, $value);
                                    if (count($values)==2) {

                                        if ($values[0] != '' and $values[1] == '') {
                                            $this->query = $this->query->where($name, ">=", $values[0]);
                                        } elseif ($values[0] == '' and $values[1] != '') {
                                            $this->query = $this->query->where($name, "<=", $values[1]);
                                        } elseif ($values[0] != '' and $values[1] != '') {

                                            //we avoid "whereBetween" because a bug in laravel 4.1
                                            $this->query =  $this->query->where(
                                                function ($query) use ($name, $values) {
                                                     return $query->where($name, ">=", $values[0])
                                                                  ->where($name, "<=", $values[1]);
                                                }
                                            );

                                        }

                                    }

                                    break;
                                case "orwherebetween":
                                    $values = explode($field->serialization_sep, $value);
                                    if (count($values)==2) {
                                        if ($values[0] != '' and $values[1] == '') {
                                            $this->query = $this->query->orWhere($name, ">=", $values[0]);
                                        } elseif ($values[0] == '' and $values[1] != '') {
                                            $this->query = $this->query->orWhere($name, "<=", $values[1]);
                                        } elseif ($values[0] != '' and $values[1] != '') {
                                            //we avoid "whereBetween" because a bug in laravel 4.1
                                            $this->query =  $this->query->orWhere(
                                                function ($query) use ($name, $values) {
                                                    return $query->where($name, ">=", $values[0])
                                                                 ->where($name, "<=", $values[1]);
                                                }
                                            );
                                        }

                                    }

                                    break;
                            }
                        }

                    }
                }
                // dd($this->query->toSql());
                break;
            case "reset":
                $this->process_status = "show";

                return true;
                break;
            default:
                return false;
        }
    }

}
