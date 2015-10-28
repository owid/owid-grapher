<?php

namespace Zofe\Rapyd;

use Illuminate\Support\Facades\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Input;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\Paginator;
use Zofe\Rapyd\Exceptions\DataSetException;

class DataSet extends Widget
{
    public $cid;
    public $source;

    /**
     *
     * @var \Illuminate\Database\Query\Builder
     */
    public $query;
    public $url  ;
    public $data = array();
    public $hash = '';
    public $key  = 'id';

    /**
     * @var \Illuminate\Pagination\Paginator
     */
    public $paginator;
    protected $orderby_check = false;
    protected $orderby_fields = [];
    protected $orderby_field;
    protected $orderby_direction;

    protected $type;
    protected $limit;
    protected $orderby;
    protected $orderby_uri_asc;
    protected $orderby_uri_desc;

    /**
     * @param $source
     *
     * @return static
     */
    public static function source($source)
    {
        $ins         = new static();
        $ins->source = $source;

        //inherit cid from datafilter
        if ($ins->source instanceof \Zofe\Rapyd\DataFilter\DataFilter) {
            $ins->cid = $ins->source->cid;
        }
        //generate new component id
        else {
            $ins->cid = $ins->getIdentifier();
        }

        return $ins;
    }

    protected function table($table)
    {
        $this->query = DB::table($table);

        return $this->query;
    }

    /**
     * @param        $field
     * @param string $dir
     *
     * @return mixed
     */
    public function orderbyLink($field, $dir = "asc")
    {
        $url = ($dir == "asc") ? $this->orderby_uri_asc : $this->orderby_uri_desc;

        return str_replace('-field-', $field, $url);
    }

    public function orderBy($field, $direction="asc")
    {
        $this->orderby = array($field, $direction);

        return $this;
    }

    public function onOrderby($field, $direction="")
    {
        $orderby = $this->url->value("ord" . $this->cid);
        if ($orderby) {
            $dir = ($orderby[0] === "-") ? "desc" : "asc";
            if (ltrim($orderby,'-') == $field) {
                return ($direction == "" || $dir == $direction) ? true : false;
            }

        } else {
            if (count($this->orderby) && ($this->orderby[0] == $field)) {
                $dir = $this->orderby[1];

                return ($direction == "" || $dir == $direction) ? true : false;
            }
        }

        return false;
    }

    /**
     * @param $items
     *
     * @return $this
     */
    public function paginate($items)
    {
        $this->limit = $items;

        return $this;
    }

    public function build()
    {
        if (is_string($this->source) && strpos(" ", $this->source) === false) {
            //tablename
            $this->type = "query";
            $this->query = $this->table($this->source);
        } elseif (is_a($this->source, "\Illuminate\Database\Eloquent\Model")) {
            $this->type = "model";
            $this->query = $this->source;
            $this->key = $this->source->getKeyName();

        } elseif ( is_a($this->source, "\Illuminate\Database\Eloquent\Builder")) {
            $this->type = "model";
            $this->query = $this->source;
            $this->key = $this->source->getModel()->getKeyName();

        } elseif ( is_a($this->source, "\Illuminate\Database\Query\Builder")) {
            $this->type = "model";
            $this->query = $this->source;

        } elseif ( is_a($this->source, "\Zofe\Rapyd\DataFilter\DataFilter")) {
           $this->type = "model";
           $this->query = $this->source->query;

            if (is_a($this->query, "\Illuminate\Database\Eloquent\Model")) {
                $this->key = $this->query->getKeyName();
            } elseif ( is_a($this->query, "\Illuminate\Database\Eloquent\Builder")) {
                $this->key = $this->query->getModel()->getKeyName();
            }

        }
        //array
        elseif (is_array($this->source)) {
            $this->type = "array";
        } else {
            throw new DataSetException(' "source" must be a table name, an eloquent model or an eloquent builder. you passed: ' . get_class($this->source));
        }

        //build orderby urls
        $this->orderby_uri_asc = $this->url->remove('page' . $this->cid)->remove('reset' . $this->cid)->append('ord' . $this->cid, "-field-")->get() . $this->hash;

        $this->orderby_uri_desc = $this->url->remove('page' . $this->cid)->remove('reset' . $this->cid)->append('ord' . $this->cid, "--field-")->get() . $this->hash;

        //detect orderby
        $orderby = $this->url->value("ord" . $this->cid);
        if ($orderby) {
            $this->orderby_field = ltrim($orderby, "-");
            $this->orderby_direction = ($orderby[0] === "-") ? "desc" : "asc";
            if ($this->canOrderby($this->orderby_field)) {
                $this->orderBy($this->orderby_field, $this->orderby_direction);
            }
        }

        //build subset of data
        switch ($this->type) {
            case "array":
                //orderby
                if (isset($this->orderby)) {
                    list($field, $direction) = $this->orderby;
                    $column = array();
                    foreach ($this->source as $key => $row) {
                        $column[$key] = is_object($row) ? $row->{$field} : $row[$field];
                    }
                    if ($direction == "asc") {
                        array_multisort($column, SORT_ASC, $this->source);
                    } else {
                        array_multisort($column, SORT_DESC, $this->source);
                    }
                }

                $limit = $this->limit ? $this->limit : 100000;
                $current_page = $this->url->value('page'.$this->cid, 0);
                $offset = (max($current_page-1,0)) * $limit;
                $this->data = array_slice($this->source, $offset, $limit);
                $this->paginator = new LengthAwarePaginator($this->data, count($this->source), $limit, $current_page,
                    ['path' => Paginator::resolveCurrentPath(),
                    'pageName' => "page".$this->cid,
                    ]);
                break;

            case "query":
            case "model":
                //orderby

                if (isset($this->orderby)) {
                    $this->query = $this->query->orderBy($this->orderby[0], $this->orderby[1]);
                }
                //limit-offset
                if (isset($this->limit)){
                    
                    $this->paginator = $this->query->paginate($this->limit, ['*'], 'page'.$this->cid);
                    $this->data = $this->paginator;
                } else {
                    $this->data = $this->query->get();
                }

                break;
        }
        return $this;
    }

    /**
     * @return $this
     */
    public function getSet()
    {
        $this->build();

        return $this;
    }

    /**
     * @return array
     */
    public function getData()
    {
        return $this->data;
    }

    /**
     * @param string $view
     *
     * @return mixed
     */
    public function links($view = null)
    {
        if ($this->limit) {
            if ($this->hash != '')
                $links =  $this->paginator->appends($this->url->remove('page'.$this->cid)->getArray())->fragment($this->hash)->render($view);
            else
                $links =  $this->paginator->appends($this->url->remove('page'.$this->cid)->getArray())->render($view);
            
            return str_replace('/?', '?', $links);
        }
    }

    public function havePagination()
    {
        return (bool) $this->limit;
    }

    /**
     * add the ability to check & enable "order by" of given field/s 
     * by default you can order by 
     * 
     * @param mixed $fieldname
     */
    public function addOrderBy($fieldname)
    {
        $this->orderby_check = true;
        $this->orderby_fields = array_merge($this->orderby_fields, (array)$fieldname);
        
        return $this;
    }
    
    protected function canOrderby($fieldname)
    {
        return (!$this->orderby_check || in_array($fieldname, $this->orderby_fields)); 
    }
}
