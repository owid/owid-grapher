module.exports = { default: function() {
	var dataflow = {}, state = {}, defaults = {}, flows = [];
	dataflow.state = state;

	dataflow._initials = {};
	dataflow._children = {};
	dataflow._listens = [];

	function defineProperty(key, val) {
		defaults[key] = val;

		if (!dataflow.hasOwnProperty(key)) {
			Object.defineProperty(dataflow, key, {
				get: function() { return state[key]; }
			});
		}
	}

	dataflow.inputs = function(inputs) {
		_.each(inputs, function(v, k) {
			defineProperty(k, v);
		});
		return dataflow;
	};

	dataflow.requires = function() {
		_.each(arguments, function(k) {
			defineProperty(k, undefined);
		});
		return dataflow;
	};

	dataflow.needs = dataflow.requires;

	dataflow.clean = function() {
		if (dataflow._beforeClean) dataflow._beforeClean();

		for (var key in state) delete state[key];
		hasDefaults = false;

		// Clear event bindings
		_.each(dataflow._listens, function(listen) {
			listen.el.on(listen.event, null);
		});

		dataflow.isClean = true;
		if (dataflow._afterClean) dataflow._afterClean();
		return dataflow;
	};

	dataflow.beforeClean = function(callback) {
		dataflow._beforeClean = callback;
	};

	dataflow.afterClean = function(callback) {
		dataflow._afterClean = callback;
	};

	dataflow.destroy = function() {
		dataflow.clean();
		return null;
	};

	// Given another flow constructor, toggle an instance of it
	// as a child of this dataflow
	dataflow.toggleChild = function(key, flowConstructor, callback) {
		var child = dataflow._children[key];
		if (!child) {
			child = flowConstructor();
			dataflow._children[key] = child;
		}

		if (child.isClean) {
			callback(child);
		} else {
			child.clean();
		}
	};

	dataflow.listenTo = function(el, event, callback) {
		el.on(event, callback);
		dataflow._listens.push({ el: el, event: event });
	};

	dataflow.defaults = dataflow.inputs;

	function parseFlowspec(flowspec) {
		var flow = {},
			spl = flowspec.split(/\s*:\s*/);

		flow.spec = flowspec;
		flow.outputs = spl[1] ? spl[0].split(/\s*,\s*/) : [];
		flow.inputs = spl[1] ? spl[1].split(/\s*,\s*/) : spl[0].split(/\s*,\s*/);

		return flow;
	}

	dataflow.initial = function(flowspec, callback) {
		var flow = parseFlowspec(flowspec);

		defineProperty(flow.inputs[0], undefined);
		dataflow._initials[flow.inputs[0]] = callback;
	};

	function addFlow(flowspec, callback) {
		var flow = parseFlowspec(flowspec);
		flow.callback = callback;

		_.each(flow.outputs, function(key) {
			defineProperty(key);
		});

		flows.push(flow);
		return flow;			
	}

	dataflow.flow = function(flowspec, callback) {
		addFlow(flowspec, callback);
		return dataflow;
	};

	dataflow.flowDebug = function(flowspec, callback) {
		var flow = addFlow(flowspec, callback);
		flow.debug = true;
		return dataflow;
	}

	dataflow.flowAwait = function(flowspec, callback) {
		var flow = addFlow(flowspec, callback);
		flow.await = true;
		return dataflow;
	};

	// Immediate flow, requiring inputs
	dataflow.now = function(flowspec, callback) {
		var flow = parseFlowspec(flowspec);

		var args = _.map(flow.inputs, function(key) {
			if (!_.has(state, key))
				throw("Missing input value: " + key);

			return state[key];
		});

		callback.apply(dataflow, args);
	};

	function isEqual(a, b) {
		return _.isEqual(a, b);
	}

	var hasDefaults = false;
	dataflow.isUpdating = false;
	dataflow.isClean = true;
	dataflow.updateQueue = [];
	function update(inputs, callback) {
		dataflow.isClean = false;

		if (dataflow.isUpdating) {
			// Queue update
			dataflow.updateQueue.push([inputs, callback]);
			return;
		}


		var changes = {};

		if (!hasDefaults) {
			_.each(dataflow._initials, function(initialCallback, key) {
				defaults[key] = initialCallback();
			});

			// Make sure we're not passing undefined values in
			var newInputs = _.clone(defaults);
			_.each(inputs, function(v,k) {
				if (v !== undefined) newInputs[k] = v;
			});
			inputs = newInputs;

			hasDefaults = true;
		}

		_.each(inputs, function(v, k) {
			if (!_.has(defaults, k))
				throw("No such input: " + k);
			if (!isEqual(state[k], v)) {
				state[k] = v;
				changes[k] = true;
			}
		});

/*			_.each(state, function(v, k) {
			if (v === undefined)
				throw("Missing input: " + k);
		});*/

		var flowIndex = 0;

		dataflow.isUpdating = true;
		function flowCycle() {
			if (flowIndex >= flows.length) {
				// End the cycle
				dataflow.isUpdating = false;
				if (_.isFunction(callback))
					callback.apply(this);
				if (dataflow.updateQueue.length > 0) {
					var args = dataflow.updateQueue.shift();
					update.apply(dataflow, args);
				}
				return;
			}

			var flow = flows[flowIndex];
			flowIndex += 1;

			if (flow.debug) {
				_.each(flow.inputs, function(key) {
					console.log(key, state[key], !!changes[key]);
				});
			}

			var inputChanged =_.any(flow.inputs, function(k) { return _.has(changes, k); });
			if (!inputChanged) return flowCycle();

			var hasArgs = true;
			var args = _.map(flow.inputs, function(k) { 
				if (!state.hasOwnProperty(k)) { hasArgs = false; }
				return state[k];
			});

			if (!hasArgs)
				return flowCycle();

			if (flow.await) {
				flow.callback.apply(dataflow, args.concat(finishFlow));
			} else {
				var outputs = flow.callback.apply(dataflow, args);
				if (flow.outputs.length == 1)
					outputs = [outputs];
				finishFlow.apply(dataflow, outputs);
			}

			function finishFlow() {
				var outputs = arguments;

				for (var i = 0; i < flow.outputs.length; i++) {
					var key = flow.outputs[i],
						result = outputs[i],
						oldResult = state[key];

					if (flow.debug) {
						console.log("=> " + key + " =", result);
					}
                    state[key] = result;                        
					if ((result && result.hasOwnProperty('state')) || !isEqual(oldResult, result)) {
						changes[key] = true;
					}
				}

				flowCycle();
			}
		}

		flowCycle();
		return dataflow;
	};

	dataflow.update = update;
	return dataflow;
} };