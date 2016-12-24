;(function() {
	"use strict";
	owid.namespace("owid.dataflow");

	owid.dataflow = function() {
		var model = {}, state = {}, defaults = {}, flows = [];
		model.state = state;

		model._initials = {};

		function defineProperty(key, val) {
			defaults[key] = val;

			if (!model.hasOwnProperty(key)) {
				Object.defineProperty(model, key, {
					get: function() { return state[key]; }
				});
			}
		}

		model.inputs = function(inputs) {
			_.each(inputs, function(v, k) {
				defineProperty(k, v);
			});
			return model;
		};

		model.requires = function() {
			_.each(arguments, function(k) {
				defineProperty(k, undefined);
			});
			return model;
		};

		model.needs = model.requires;

		model.clean = function() {
			if (model._beforeClean) model._beforeClean();
			for (var key in state) delete state[key];
			hasDefaults = false;
			if (model._afterClean) model._afterClean();
			return model;
		};

		model.beforeClean = function(callback) {
			model._beforeClean = callback;
		};

		model.afterClean = function(callback) {
			model._afterClean = callback;
		}

		model.destroy = function() {
			model.clean();
			return null;
		};

		model.defaults = model.inputs;

		function parseFlowspec(flowspec) {
			var flow = {},
				spl = flowspec.split(/\s*:\s*/);

			flow.spec = flowspec;
			flow.outputs = spl[1] ? spl[0].split(/\s*,\s*/) : [];
			flow.inputs = spl[1] ? spl[1].split(/\s*,\s*/) : spl[0].split(/\s*,\s*/);

			return flow;
		}

		model.initial = function(flowspec, callback) {
			var flow = parseFlowspec(flowspec);

			defineProperty(flow.inputs[0], undefined);
			model._initials[flow.inputs[0]] = callback;
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

		model.flow = function(flowspec, callback) {
			addFlow(flowspec, callback);
			return model;
		};

		model.flowDebug = function(flowspec, callback) {
			var flow = addFlow(flowspec, callback);
			flow.debug = true;
			return model;
		}

		model.flowAwait = function(flowspec, callback) {
			var flow = addFlow(flowspec, callback);
			flow.await = true;
			return model;
		};

		// Immediate flow, requiring inputs
		model.now = function(flowspec, callback) {
			var flow = parseFlowspec(flowspec);

			var args = _.map(flow.inputs, function(key) {
				if (!_.has(state, key))
					throw("Missing input value: " + key);

				return state[key];
			});

			callback.apply(model, args);
		};

		function isEqual(a, b) {
			return _.isEqual(a, b);
		}

		var hasDefaults = false;
		model.isUpdating = false;
		model.updateQueue = [];
		function update(inputs, callback) {
			if (model.isUpdating) {
				// Queue update
				model.updateQueue.push([inputs, callback]);
				return;
			}


			var changes = {};

			if (!hasDefaults) {
				_.each(model._initials, function(initialCallback, key) {
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

			model.isUpdating = true;
			function flowCycle() {
				if (flowIndex >= flows.length) {
					// End the cycle
					model.isUpdating = false;
					if (_.isFunction(callback))
						callback.apply(this);
					if (model.updateQueue.length > 0) {
						var args = model.updateQueue.shift();
						update.apply(model, args);
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
					flow.callback.apply(model, args.concat(finishFlow));
				} else {
					var outputs = flow.callback.apply(model, args);
					if (flow.outputs.length == 1)
						outputs = [outputs];
					finishFlow.apply(model, outputs);
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
			return model;
		};

		model.update = update;
		return model;
	};
})();