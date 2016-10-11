jQuery(function() {

  var AppState = can.Map.extend({});
  var appState = new AppState();
  var app_ready = new can.Deferred();
  //window.appState=appState;
  var app = {};

  var api = function() {
    var base_url = '/api';

    return {
      features: function() { return can.ajax(base_url+'/features'); },
      rankings: function() { return jQuery.get(base_url+'/rankings'); },
      tasks: function() { return can.ajax(base_url+"/tasks"); },
      records: function(taskid) { 
	return can.ajax({
	  url: base_url+'/task/'+taskid+'/records'
	});
      },
      rank: function(model,run) {
	var x = can.ajax({
	  url: base_url+"/rank",
	  method: "POST",
	  data: JSON.stringify({
	    weights: model.get_weights().weights,
	    solr: model.get_weights().solr,
	    run: run,
	    model: model.model,
	    normalize_weights: model.normalize_weights
	  }),
	  processData: false
	});
	return x;
      }
    };
  }();

  var load_features = api.features();
  var Features = {};
  var feature_iterator = function(features) {
    features.forEach(function(e) {
      if(e.key) {
        Features[e.key] = e;
      }
      if(e.items) {
	feature_iterator(e.items);
      }
    });
  }
  load_features = load_features.then(function(data) {
    data = new can.List(data);

    feature_iterator(data);
    app_ready.then(function() {
    var vm = { 
      "items": data,
      toggle: function(f) {
        var rm = appState.attr("current_model");
        if(rm.has_feature(f.key)) {
	  rm.remove_feature(f.key);
	} else {
	  rm.add_feature(f.key,0);
	}
      },
      selected: function(f) {
        if(appState.attr("current_model").has_feature(f.key)) {
	  return "selected";
	} else {
	  return "";
	}
      }
    };
    jQuery('#modals').append( can.view('components/feature_selection/feature_selection.stache', vm) );
    });
  });

  var load_rankings= api.rankings();
  
  var RankingModel = can.Map.extend({
    define: {
      name: {
	value: 'Custom model'
      },
      model: {
	value: 'pOWAv1'
      },
      modifiable: { value: true },
      normalize_weights: { value: true },
      weights: {
	//value: function() { return new can.List(); }
	value: function() { 
	  var w = new can.Map({ 
	    perm: [
	      { key: 'lr_w_qi', value: 1, label: 'Scaling factor', description: 'Scaling factor for query independent features. This factor is applied to all other parameters simultaneously.' }
	    ],
	    free: [],
	    solr: []
	  });
	  var self = this;
	  w.delegate("*.*.value", "set", function(ev, newElements, index) {
	    // HACK: Avoid duplicate calculation of scores for immutable
	    //       models. If the model is immutable (i.e. a predefined
	    //       model) then it will get cloned in the ranking_model 
	    //       compontent (if it is the current_model) and be reset
	    //       by the rankings_selector. 
	    if(self.immutable) {
	    } else {
	      //console.log("weights.change");
	      can.event.dispatch.call(self, "weights.change");
	    }
	  });
	  w.delegate("free", "remove", function(ev, newElements, index) {
	    if(self.immutable) {
	    } else {
	      can.event.dispatch.call(self, "weights.change");
	    }
	  });
	  return w;
	}
      }
    },
    clone: function() {
      var clone = new RankingModel();
      clone.attr("name", this.attr("name"));
      clone.attr("model", this.attr("model"));
      clone.attr("modifiable", this.attr("modifiable"));
      clone.attr("normalize_weights", this.attr("normalize_weights"));

      clone.attr("weights.perm", new can.List(this.attr("weights.perm").serialize()));
      clone.attr("weights.free", new can.List(this.attr("weights.free").serialize()));
      clone.attr("weights.solr", new can.List(this.attr("weights.solr").serialize()));
      return clone;
    },
    make_immutable: function() {
      this.immutable=true;
    },
    notify: function() { can.event.dispatch.call(this, "weights.change"); },
    add_feature: function(f,v) {
      this.attr('weights.free').push({ key: f, value: 0 });
    },
    set_features: function(weights) {
      var self = this;
      weights.forEach(function(el,i) {
	if(el.key=="lr_w_qi") {
	  self.attr('weights.perm').forEach(function(x,j) {
	    if(x.key == el.key) {
	      x.attr("value", el.value);
	    }
	  });
	} else {
	  self.attr('weights.free').push({ key: el.key, value: el.value });
	}
      });
      // do we need this?
      //can.event.dispatch.call(this, "weights.change");
    },
    set_solr: function(weights) {
      var self = this;
      weights.forEach(function(el,i) {
	self.attr('weights.solr').push({ key: el.key, value: el.value });
      });
      // do we need this?
      //can.event.dispatch.call(this, "weights.change");
    },
    remove_feature: function(f) {
      var features = this.attr('weights.free');
      var index = [];
      features.forEach(function(el,i) {
	if(el.key==f) {
	  index.push(i);
	}
      });
      if(index.length>0){
	features.splice(index[0],1);
      }
    },
    has_feature: function(f) {
      var features = this.attr('weights.free');
      //console.log("has feature");
      var x = features.filter(function(el,i) {
	return el.key==f;
      });
      return x.length>0;
    },
    get_weights: function() {
      var res = [];
      var x = this.attr('weights.free').serialize();
      x = x.concat(this.attr('weights.perm').serialize());
      return { weights: x, solr: this.attr('weights.solr').serialize() };
    }
  });



  var create_ranking_model = function(r) {
    //console.log("create ranking");
    var rm = new RankingModel();
    rm.attr('name', r.name);
    if(r.ranking=="EconBiz") {
      rm.attr('model','EconBiz');
      rm.attr('modifiable',false);
    }
    rm.attr("normalize_weights", r.normalize_weights);
    rm.set_features(r.weights);
    rm.set_solr(r.solr);
    return rm;
  };
  //window.Features = Features;
  var Rankings = {
    predefined: new can.List(can.when(load_rankings, load_features).then(function(v1) {
      can.batch.start();
      var data = v1[0];
      data.runs.forEach(function(run,i) {
        run.rankings.forEach(function(el,j) {
	  el.immutable=true;
	  el.weights.forEach(function(w,i) {
	    if(w.key=="lr_w_qi") { 
	      w.i = -1;
	    } else {
	      w.i = Features[w.key].uuid;
	    }
	  });
	  el.weights.sort(function(a,b) { return a.i-b.i; })
	  el.model=create_ranking_model(el);
	  el.model.make_immutable();
	});
      });
      can.batch.stop();
      return data.runs;
    })),
    custom: new can.List()
  };

  jQuery('#modals').append( 
    can.view('components/rankings_selection/modal.stache', 
    {
      rankings: Rankings,
      select: function(r) {
	if(r.immutable) {
	  var rm = create_ranking_model(r);
	  rm.make_immutable();
	  r.model = rm;
	}
	appState.attr("current_model", r.model);
	r.model.notify();
      },
      selected: function(r) {
	return appState.attr("current_model")===r.model;
      }
    }
    )
  );
  //window.Rankings = Rankings;


  var ResultList = can.Map.extend({ 
    define: {
      task: {
        value: new can.Map()
      },
      items: {
	Value: can.List
      }
    },
    update_items: function() {
      //console.time("update items");
      var task = this.attr('task');
      if(!( "items_lookup" in this.task)) {
	this.task.items_lookup = {};
      }
      var items_lookup = this.task.items_lookup;

      //console.log('update items');
      if(! task.results) return;

      var res = task.results;
      var self = this;
      var recs = null;
      if(!( "items" in this.task) || this.task.items.length==0) {
	recs = api.records(task.attr("SearchTask"));
      }
      can.batch.start();
	//console.time("item");
      res.ranked_list.forEach(function(item, i) {
	var _item = items_lookup[item.record_id];
	var b   = '-';
	if( task.attr('baseline.idx') ) {
	  b = task.attr('baseline.idx')[item.record_id];
	}
	if(_item == null) {
	  _item = {
	    baseline: { pos: b }, 
	    id: item.record_id, 
	    pos: new can.Map({ current: i+1, baseline: b }), 
	    sid:task.attr('SearchTask'),
	    current: new can.Map({
	      score: item.score,
	      text_score: item.text_score
	    })
	  };
	  items_lookup[item.record_id] = new can.Map(_item);
	  items_lookup[item.record_id].record = {};
	  items_lookup[item.record_id].record_data = {};
	} else {
	  _item.pos.attr("current", i+1);
	  _item.current.attr("score", item.score);
	  _item.current.attr("text_score", item.text_score);
	  _item.pos.attr("baseline", b);
	  if(self.task.ideal) {
	    _item.attr("qrel_ideal", self.task.ideal[i]);
	  }
	}
      });
      can.batch.stop();
	//console.timeEnd("item");
      if(!( "items" in this.task) || this.task.items.length==0) {
	var ideal = [];
	recs.then(function(data) {
	  //console.time('update batch');
	  can.batch.start();
	  var obj = items_lookup;
	  var items = Object.keys(obj).map(function (key) {return obj[key]});
	  //console.time("set items");
	  self.task.attr("items",items);
	  //console.timeEnd("set items");

	  data.forEach(function(el,i) {
	    //console.log("item - record_data");
	    var item = self.task.items_lookup[el.metadata.id];
	    item.record = el.metadata;

	    var features = [];
	    for(var key in el.features) {
	      var f = Features[key];
	      if(f==null || f.hide) { continue; }
	      features.push({name: f.label, value: Number(el.features[key]).toFixed(3), uuid: f.uuid});
	    }
	    features.sort(function(a,b) { 
	      return a.uuid - b.uuid;
	    });
	    item.record_data = { qrel: el.qrel, features_sorted: features};
	    ideal.push(el.qrel.gradual);
	  });
	  ideal.sort(function(a,b) { return b-a;} );
	  items.forEach(function(el,i) {
	    el.attr("qrel_ideal", ideal[el.attr("pos.current")-1]);
	  });
	  self.task.ideal = ideal;

	  can.batch.stop();
	  //console.timeEnd('update batch');
	  //can.event.dispatch.call(self.attr("task"), "change");

	  can.event.dispatch.call(self.attr("task.items"), "updated");
	});
      } else {
	// HACK: we must delay triggering the 'items.updated' event, since
	//       otherwise the event listener in the result-list component
	//       is not triggered.
	setTimeout(function() {
	  can.event.dispatch.call(self.attr("task.items"), "updated");
	}, 0);
      }

      //console.log('items update - end');
      //console.timeEnd("update items");
    }
  });
  var result_list = new ResultList();
  result_list.delegate("task", "set", function(ev,newVal, oldVal, prop) {
    //console.log(ev,newVal, oldVal, prop);
    if(prop != "task") { return; }
    result_list.update_items();
  });
  appState.bind("performance_updated", function() {
    result_list.update_items();
  });
  //window.result_list=result_list;
  
  can.Component.extend({
    tag: 'result-list',
    template: can.view('components/result_list/result_list.stache'),
    viewModel: result_list,
    events: {
      '{task.items} updated': function() {
	//console.log("result list - items updated");
	//console.time("isotope");
	var $grid = jQuery(this.element).find(".result-list").isotope({
	  itemSelector: '.result-list-item',
	  layoutMode: 'vertical',
	  getSortData: {
	    pos_current: '.pos-current parseInt'
	  },
	  sortBy : 'pos_current'
	});
	//$grid.isotope( 'updateSortData', jQuery(this.element).find(".result-list .row") );
	$grid.isotope('reloadItems');
	$grid.isotope({ sortBy: "pos_current" });
	//console.timeEnd("isotope");
      }
    }
  });
  
  can.Component.extend({
    tag: 'result-list-item',
    template: can.view('components/result_list/result_list_item.stache'),
    viewModel: {
      color: function(x) {
	var delta = Number(this.item.record_data.qrel.gradual) - Number(this.attr('item.qrel_ideal'));
	var abs = Math.abs(delta);
	// limit the maximal color (alpha=1 looked quite harsh)
	var alpha = abs/100*0.6;

	if(delta<0) {
          return 'rgba(255,0,0,'+alpha+')';
	} else {
          return 'rgba(0,255,0,'+alpha+')';
	}
      }
    }
  });

  can.view.tag('slider', function(el,tagData) {
    var frag = tagData.subtemplate(tagData.scope,tagData.options);
    jQuery(el).html(frag);
    var params = { focus: true };

    var slider = jQuery(el).find("input").slider(params);
    slider.on('slideStop', function(ev) {
      // update model after new value has been selected
      // NOTE: if two-way binding is enabled in the template,
      //       this leads to very rapid recalculation of the scores.
      //       Hence, we update the model in this way.
      tagData.scope.attr("value", ev.value);
    });
    setTimeout(function() { slider.slider('relayout'); },1);
  });
  can.Component.extend({
    tag: 'ranking-model',
    template: can.view('components/ranking_model/ranking_model.stache'),
    //viewModel: RankingModel,
    viewModel: { 
      appState: appState,
      finishEditing: function(c,el) {
	jQuery(el).parents('.editable').removeClass('editing');
      }
    },
    helpers: {
      feature: function(f,options) {
        return options.fn(Features[f]);
      }
    },
    events: {
      '.editable .view click': function(el) {
	jQuery(el).parents('.editable').addClass('editing');
	jQuery(el).parents('.editable').find(".edit input").eq(0).focus();
      },
      '.editable .edit * blur': function(el) {
	jQuery(el).parents('.editable').removeClass('editing');
      },
      'button.add click': function(el) {
	var $name = jQuery(el).prev('input').val();
	jQuery(el).prev('input').val('');
	this.viewModel.attr('weights').push(new can.Map({name: $name, value: 0}));
      }, 
      'button.save_baseline click': function(el) {
	can.batch.start();
	appState.attr("baseline_model", appState.attr("current_model").clone() );
	//console.time("save_baseline");
	appState.attr("current_tasks").forEach(function(task) {
	  //console.log(task);
	  task.save_baseline();
	});
	//console.timeEnd("save_baseline");
	can.batch.stop();

	//console.log(tasks.attr(1));
	//result_list.attr('task', tasks.attr(1));
	//console.log(tasks.attr(1).attr('results'));
	can.event.dispatch.call(appState, "performance_updated");
      },
      '{appState.current_model} change': function(target,ev, attr, how, newVal, oldVal) {
	var cm = appState.attr("current_model");
	if(cm.immutable) {
	  //console.log("clone immutable model");
	  var clone = cm.clone();
	  if(attr!="name") {
	    clone.attr("name", clone.attr("name")+"*");
	  }
	  //console.log(clone);
	  Rankings.custom.push({model: clone});
	  appState.attr("current_model", clone);
	  clone.notify();
	}
      }
    }
  });
  

  var Task = can.Model.extend({
    findAll: function() { return api.tasks() },
    id: "SearchTask",
    define: {
      results: {
	value: {}
      },
      items: {
	value: new can.List()
      },
      performance: {
        value: new can.Map()
      }
    }
  }, {
    set_baseline_performance: function(p,results) {
      if(this.attr("baseline")==null) {
	this.attr("baseline", {});
      }
      this.attr("baseline.performance", p);

      var idx = {};
      var i = 1;
      
      results.ranked_list.forEach(function(item) {
	idx[item.record_id] = i;
	i++;
      });
      this.attr("baseline.idx",idx);
    },
    save_baseline: function() {
      var baseline = new can.Map({
	performance: this.attr('performance')
      });
      // do not store results as attribute of the map
      // since binding listeners gives a huge performance hit.
      baseline.results=this.results;

      var idx = {};
      var i = 1;
      
      this.results.ranked_list.forEach(function(item) {
	  idx[item.record_id] = i;
	  i++;
	});
	baseline.attr('idx',idx);
      
      this.attr('baseline', baseline);
    },
    select_task: function(task) {
      appState.attr('current_task', task);
    }
  }); // second argument in extend to trigger can.Model.extend(staticProps, instanceProps)
  //window.Task = Task;
  can.stache.registerHelper('pretty', function(key, options){
    //console.log(key);
    var v = typeof key === "function" ? key() : key;
    var n = options.hash["n"] || 3;
    if(isNaN(v)) {
      return '-';
    }
    return v.toFixed(n);
  });

  Task.List = Task.List.extend({
    performance: function() {
      //console.time("task list - performance");
      if(this.length==0) { 
	return { current: {}, baseline: {} }; 
      }
      var p = this.map(function(task) {
	return { 
	  current:  task.attr('performance'),
	  baseline: task.attr('baseline.performance')
	};
      });
      //console.log(p);
      p=p.attr().reduce(function(prev,cur) {
	var x = { current: {}, baseline: {} };
	for(var k in prev.current) {
	  x.current[k] = prev.current[k] + cur.current[k];
	}
	for(var k in prev.baseline) {
	  x.baseline[k] = prev.baseline[k] + cur.baseline[k];
	}
	return x;
      });
      var n = this.length;
      if(n>0) {
	for(var k in p.current) {
	  p.current[k] *= 1/n;
	  p.baseline[k] *= 1/n;
	}
      } else {
	//return null;
      }
      //console.timeEnd("task list - performance");
      return p;
    }
  });
  Task.List.prototype.get_performance_scores = function(measure="nDCG_10") {
    var p = this.map(function(task) {
      var b = task.attr('baseline.performance');
      if(b) {
	b= b.attr(measure);
      } else {
	b = null;
      }
      return { 
	current:  task.attr('performance').attr(measure),
	baseline: b,
	"task": task
      };
    });
    return p;
  };
  
  appState.performance = new can.Map({
    list: function(tasks) {
      //console.log(tasks);
      //tasks = appState.attr('current_tasks');
      if(tasks == null) { return; }
      var p = tasks.performance();
      var m = [
	{ key: 'nDCG_10', label: 'nDCG@10' },
	{ key: 'nERR_20', label: 'nERR@20' },
	{ key: 'Prec_10', label: 'Prec@10' }
      ];
      var x = [];
      m.forEach(function(m_) {
	m_.current = p.current[m_.key];
	m_.baseline = p.baseline[m_.key];
      });
      return m;
    }
  });


  var tasks = Task.findAll({});
  var Tasks = new Task.List(tasks);
  var tasks_map = {};
  var stats = can.Map();

  app.tasks = tasks;
  //window.tasks = tasks;
  //window.Tasks = Tasks;

  can.Component.extend({
    tag: 'tasks',
    template: can.view('components/tasks/tasks.stache'),
    viewModel: { 
      "tasks": tasks, "stats": stats, run: null, 
      filter: function() {
	var run = this.attr("current_run.run");
	var tasks = Tasks.filter(function(item,i) {
	  return item.run==run;
	});
	appState.attr("current_tasks", tasks);
	this.update_performance_and_baseline();
	return tasks;
      },
      update_performance: function() {
	//console.log("update_performance");
	//console.time("update_performance");
	var self = this;
	var model = this.current_model;
	var x = api.rank(model, this.current_run.run);
	x.done( function(res) {
	  can.batch.start();
	  res.forEach(function(data) {
	    var task = Task.store[data.task];
	    if(task==null) { return; }

	    task.results = data.res;
	    task.attr('performance', data.res.score);
	  });
	  can.batch.stop();

	  //console.timeEnd("update_performance");
	  //console.log('rank tasks - end');
	  //console.log('rank tasks - trigger performance updated');
	  //can.trigger(tasks, 'performance_updated');
	  //can.event.dispatch.call(appState, "performance_updated");
	  //self.update_performance_stats();
	  //console.log(res);
	}).fail( function(xxx) {
	});
	return x;
      },
      update_performance_baseline: function() {
	//console.log("update baseline performance");
	if(!this.baseline_model) { return; };

	var self = this;
	var model = this.baseline_model;
	var x = api.rank(model, this.current_run.run);
	x.done( function(res) {
	  can.batch.start();
	  res.forEach(function(data) {
	    var task = Task.store[data.task];
	    if(task==null) { return; }

	    task.set_baseline_performance(data.res.score,data.res);
	  });
	  can.batch.stop();
	  //console.log('rank tasks - end');
	  //can.trigger(tasks, 'performance_updated');
	  //can.event.dispatch.call(appState, "performance_updated");
	}).fail( function(xxx) {
	});
	return x;
      },
      update_performance_and_baseline: function() {
	if(this.current_model == null) { return; }
	can.batch.start();
	can.when(
	  this.update_performance_baseline(),
	  this.update_performance()
	).then(function() {
	  can.batch.stop();
	  can.event.dispatch.call(appState, "performance_updated");
	});
      }
    },
    events: {
      '{current_model} weights.change': function() {
	this.viewModel.update_performance().then(function() {
	  can.event.dispatch.call(appState, "performance_updated");
	});
      }
    }
  });


  // Bind the application state to the root of the application
  appState.attr("runs", [ 
    { label: "Run 1", run: 1 }, 
    { label: "Run 2", run: 2 }, 
    { label: "Run 3", run: 3} 
  ]);
  $('.main').html(can.view('main.stache', appState));     


nv.addGraph(function() {
  var chart = nv.models.scatterChart()
                .showDistX(true)    //showDist, when true, will display those little distribution lines on the axis.
                .showDistY(true)
                .duration(500)
                .color(d3.scale.category10().range());
  chart.scatter.duration(1000);
  chart.showLegend(false);
  chart.noData("");

  //Axis settings
  chart.xAxis.axisLabel("nDCG@10 (baseline)");
  chart.xAxis.tickFormat(d3.format('.02f'));
  chart.yAxis.axisLabel("ΔnDCG@10 (current-baseline)");
  chart.yAxis.tickFormat(d3.format('.02f'));
  //chart.yAxis.forceY([-1,1]);
  chart.forceX([0,1]);

  //Configure how the tooltip looks.
  chart.tooltip.contentGenerator(function (obj) { 
    var task = obj.point.task;
    var tooltip = '<h4>'+task.query+'</h4><ul>';
    tooltip += '<li>Current: '+obj.point.current.toFixed(3)+'</li>';
    tooltip += '<li>Baseline: '+obj.point.x.toFixed(3)+'</li>';
    tooltip += '<li>Delta: '+obj.point.y.toFixed(3)+'</li>';
    tooltip += '</ul>';
    return tooltip;
  });
  chart.scatter.dispatch.on('elementClick', function(e) {
    appState.attr('current_task', e.point.task);
  });

  var init = false;

    appState.bind('performance_updated', function() {
      //console.log("update graph data");
      if(!appState.baseline_model) { return; }
      init = true;
      var data = appState.current_tasks.get_performance_scores();
      data = data.map(function(el) {
	return {
	  x: el.baseline,
	  y: el.current-el.baseline,
	  current: el.current,
	  task: el.task
	};
      });
      var max = data.map(function(el) { return el.y; }).attr()
	.reduce(function(prev,cur) { return Math.max(prev,Math.abs(cur)); }, 0);
      // add some space
      max = 1.05*max;
      // only change range in discrete steps (to reduce number of axis rescalings)
      max = Math.ceil(max*10)/10;
      chart.forceY([-max,max]);
      // HACK: When we change the limits AND add new data, rendering of the new 
      // points does not respect new axis/scale/domain. Hence, we first update the
      // chart and then add new data.
      chart.update();

      d3.select('#chart svg')
        .datum([{ values: data }])
	.call(chart);
    });

  d3.select('#chart svg').datum([]).call(chart);

  nv.utils.windowResize(function() { if(init) { chart.update(); } });
  //window.chart = chart;
  return chart;
});


  can.when(load_rankings, load_features, tasks).then(function() {
    //can.batch.start();
    appState.attr("current_task", appState.attr("current_tasks.0"));
    appState.attr("current_model", Rankings.predefined[0].rankings[0].model);
    appState.attr("current_model").notify();
    //can.batch.stop();

    app_ready.resolve(true);
    appState.attr("ready", true);
    jQuery("body > .overlay").eq(0).remove();
    jQuery("#quick-tour").click(function() {
      startIntro();
      return false;
    });
    setTimeout(startIntro, 2000);
  });


});
