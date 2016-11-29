;(function() {
	"use strict";
	owid.namespace("owid.dataflow");

	owid.dataflow = function() {
		var model = {}, state = {}, defaults = {}, flows = [];
		model.state = state;

		function defineProperty(key, val) {
			state[key] = undefined;
			defaults[key] = val;

			Object.defineProperty(model, key, {
				get: function() { return state[key]; }
			});
		}

		model.inputs = function(inputs) {
			_.each(inputs, function(v, k) {
				defineProperty(k, v);
			});
		};

		model.flow = function(flowspec, callback) {
			var flow = {},
				spl = flowspec.split(/\s*:\s*/);

			flow.outputs = spl[1] ? spl[0].split(/\s*,\s*/) : [];
			flow.inputs = spl[1] ? spl[1].split(/\s*,\s*/) : spl[0].split(/\s*,\s*/);
			flow.callback = callback;

			_.each(flow.outputs, function(key) {
				defineProperty(key);
			});

			flows.push(flow);
		};

		var hasDefaults = false;
		model.update = function(inputs) {
			var changes = {};

			if (!hasDefaults) {
				// Make sure we're not passing undefined values in
				var newInputs = _.clone(defaults);
				_.each(inputs, function(v,k) {
					if (v !== undefined) newInputs[k] = v;
				});
				inputs = newInputs;

				hasDefaults = true;
			}

			_.each(inputs, function(v, k) {
				if (!_.has(state, k))
					throw("No such input: " + k);
				if (!_.isEqual(state[k], v)) {
					state[k] = v;
					changes[k] = true;
				}
			});

			_.each(flows, function(flow) {
				var inputChanged =_.any(flow.inputs, function(k) { return _.has(changes, k); });
				if (!inputChanged) return;

				var hasArgs = true;
				var args = _.map(flow.inputs, function(k) { 
					if (!state.hasOwnProperty(k)) { hasArgs = false; }
					return state[k];
				});

				if (!hasArgs)
					return;

				if (flow.outputs.length > 0) {
					//console.log(flow.outputs[0] + " : " + flow.inputs.join(", "));
				} else {
					//console.log(flow.inputs.join(", "));
				}			

	//			var oldResult = flow.outputs.length > 0 && _.clone(state[flow.outputs[0]]);			
				var result = flow.callback.apply(model, args);

				if (flow.outputs.length > 0) {// && !_.isEqual(oldResult, result)) {
					state[flow.outputs[0]] = result;
					changes[flow.outputs[0]] = true;
				}
			});
		};

		return model;
	};
})();