(function() {
  var Analyser, AudioBufferSource, BiquadFilter, Convolver, Delay, DynamicsCompressor, Gain, Mooog, MooogAudioNode, Oscillator, StereoPanner, Track, WaveShaper,
    slice = [].slice,
    extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    hasProp = {}.hasOwnProperty;

  MooogAudioNode = (function() {
    function MooogAudioNode() {
      var _instance, i, j, len, node_list;
      _instance = arguments[0], node_list = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      this._instance = _instance;
      this._destination = this._instance._destination;
      this.context = this._instance.context;
      this._nodes = [];
      this.config_defaults = {
        connect_to_destination: true
      };
      this.config = {};
      if (this.__typeof(node_list[0]) === "string" && this.__typeof(node_list[1]) === "string" && (Mooog.LEGAL_NODES[node_list[1]] != null)) {
        return new Mooog.LEGAL_NODES[node_list[1]](this._instance, {
          id: node_list[0]
        });
      }
      if (node_list.length === 1) {
        if (this.constructor.name !== "MooogAudioNode") {
          return;
        }
        if (Mooog.LEGAL_NODES[node_list[0].node_type] != null) {
          return new Mooog.LEGAL_NODES[node_list[0].node_type](this._instance, node_list[0]);
        } else {
          throw new Error("Omitted or undefined node type in config options.");
        }
      } else {
        for (j = 0, len = node_list.length; j < len; j++) {
          i = node_list[j];
          if (Mooog.LEGAL_NODES[node_list[i].node_type != null]) {
            this._nodes.push(new Mooog.LEGAL_NODES[node_list[i].node_type](this._instance, node_list[i]));
          } else {
            throw new Error("Omitted or undefined node type in config options.");
          }
        }
      }
    }

    MooogAudioNode.prototype.configure_from = function(ob) {
      var k, ref, v;
      this.id = ob.id != null ? ob.id : this.new_id();
      ref = this.config_defaults;
      for (k in ref) {
        v = ref[k];
        this.config[k] = k in ob ? ob[k] : this.config_defaults[k];
      }
      return this.config;
    };

    MooogAudioNode.prototype.zero_node_settings = function(ob) {
      var k, v, zo;
      zo = {};
      for (k in ob) {
        v = ob[k];
        if (!(k in this.config_defaults || k === 'node_type' || k === 'id')) {
          zo[k] = v;
        }
      }
      return zo;
    };

    MooogAudioNode.prototype.zero_node_setup = function(config) {
      var k, ref, results, v;
      if (this._nodes[0] != null) {
        this.expose_methods_of(this._nodes[0]);
      }
      ref = this.zero_node_settings(config);
      results = [];
      for (k in ref) {
        v = ref[k];
        this.debug("zero node settings, " + k + " = " + v);
        results.push(this.param(k, v));
      }
      return results;
    };

    MooogAudioNode.prototype.toString = function() {
      return (this.constructor.name + "#") + this.id;
    };

    MooogAudioNode.prototype.new_id = function() {
      return this.constructor.name + "_" + (Math.round(Math.random() * 100000));
    };

    MooogAudioNode.prototype.__typeof = function(thing) {
      if (thing instanceof AudioParam) {
        return "AudioParam";
      }
      if (thing instanceof AudioNode) {
        return "AudioNode";
      }
      if (thing instanceof AudioBuffer) {
        return "AudioBuffer";
      }
      if (thing instanceof PeriodicWave) {
        return "PeriodicWave";
      }
      if (thing instanceof AudioListener) {
        return "AudioListener";
      }
      if (thing instanceof MooogAudioNode) {
        return "MooogAudioNode";
      }
      return typeof thing;
    };

    MooogAudioNode.prototype.insert_node = function(node, ord) {
      var length;
      length = this._nodes.length;
      if (ord == null) {
        ord = length;
      }
      if (node._destination != null) {
        node.disconnect(node._destination);
      }
      if (ord > length) {
        throw new Error("Invalid index given to insert_node: " + ord + " out of " + length);
      }
      this.debug("insert_node of " + this + " for", node, ord);
      if (ord === 0) {
        this.connect_incoming(node);
        this.disconnect_incoming(this._nodes[0]);
        if (length > 1) {
          node.connect(this.to(this._nodes[0]));
          this.debug('- node.connect to ', this._nodes[0]);
        }
      }
      if (ord === length) {
        if (ord !== 0) {
          this.safely_disconnect(this._nodes[ord - 1], this.from(this._destination));
        }
        if (ord !== 0) {
          this.debug("- disconnect ", this._nodes[ord - 1], 'from', this._destination);
        }
        if (this.config.connect_to_destination) {
          node.connect(this.to(this._destination));
          this.debug('- connect', node, 'to', this._destination);
        }
        if (ord !== 0) {
          this._nodes[ord - 1].connect(this.to(node));
        }
        if (ord !== 0) {
          this.debug('- connect', this._nodes[ord - 1], "to", node);
        }
      }
      if (ord !== length && ord !== 0) {
        this.safely_disconnect(this._nodes[ord - 1], this.from(this._nodes[ord]));
        this.debug("- disconnect", this._nodes[ord - 1], "from", this._nodes[ord]);
        this._nodes[ord - 1].connect(this.to(node));
        this.debug("- connect", this._nodes[ord - 1], "to", node);
        node.connect(this.to(this._nodes[ord]));
        this.debug("- connect", node, "to", this._nodes[ord]);
      }
      this._nodes.splice(ord, 0, node);
      return this.debug("- spliced:", this._nodes);
    };

    MooogAudioNode.prototype.add = function(nodes) {
      var i, j, len, results;
      if (!(nodes instanceof Array)) {
        nodes = [nodes];
      }
      results = [];
      for (j = 0, len = nodes.length; j < len; j++) {
        i = nodes[j];
        switch (this.__typeof(i)) {
          case "MooogAudioNode":
            results.push(this.insert_node(i));
            break;
          case "object":
            results.push(this.insert_node(this._instance.node(i)));
            break;
          default:
            throw new Error("Unknown argument type (should be config object or MooogAudioNode)");
        }
      }
      return results;
    };

    MooogAudioNode.prototype.connect_incoming = function() {};

    MooogAudioNode.prototype.disconnect_incoming = function() {};

    MooogAudioNode.prototype.connect = function(node, output, input, return_this) {
      var target;
      if (output == null) {
        output = 0;
      }
      if (input == null) {
        input = 0;
      }
      if (return_this == null) {
        return_this = true;
      }
      this.debug("called connect from " + this + " to " + node + ", " + output);
      switch (this.__typeof(node)) {
        case "AudioParam":
          this._nodes[this._nodes.length - 1].connect(node, output);
          return this;
        case "string":
          node = this._instance.node(node);
          target = node._nodes[0];
          break;
        case "MooogAudioNode":
          target = node._nodes[0];
          break;
        case "AudioNode":
          target = node;
          break;
        default:
          throw new Error("Unknown node type passed to connect");
      }
      switch (false) {
        case typeof output !== 'string':
          this._nodes[this._nodes.length - 1].connect(target[output], input);
          break;
        case typeof output !== 'number':
          this._nodes[this._nodes.length - 1].connect(target, output, input);
      }
      if (return_this) {
        return this;
      } else {
        return node;
      }
    };

    MooogAudioNode.prototype.chain = function(node, output, input) {
      if (output == null) {
        output = 0;
      }
      if (input == null) {
        input = 0;
      }
      if (this.__typeof(node) === "AudioParam" && typeof output !== 'string') {
        throw new Error("MooogAudioNode.chain() can only target AudioParams when used with the signature .chain(target_node:Node, target_param_name:string)");
      }
      this.disconnect(this._destination);
      return this.connect(node, output, input, false);
    };

    MooogAudioNode.prototype.to = function(node) {
      switch (this.__typeof(node)) {
        case "MooogAudioNode":
          return node._nodes[0];
        case "AudioNode":
          return node;
        default:
          throw new Error("Unknown node type passed to connect");
      }
    };

    MooogAudioNode.prototype.from = MooogAudioNode.prototype.to;

    MooogAudioNode.prototype.expose_methods_of = function(node) {
      var key, results, val;
      this.debug("exposing", node);
      results = [];
      for (key in node) {
        val = node[key];
        if (this[key] != null) {
          continue;
        }
        switch (this.__typeof(val)) {
          case 'function':
            results.push(this[key] = val.bind(node));
            break;
          case 'AudioParam':
            results.push(this[key] = val);
            break;
          case "string":
          case "number":
          case "boolean":
          case "object":
            results.push((function(o, node, key) {
              return Object.defineProperty(o, key, {
                get: function() {
                  return node[key];
                },
                set: function(val) {
                  return node[key] = val;
                },
                enumerable: true,
                configurable: true
              });
            })(this, node, key));
            break;
          default:
            results.push(void 0);
        }
      }
      return results;
    };

    MooogAudioNode.prototype.safely_disconnect = function(node1, node2, output, input) {
      var e, source, target;
      if (output == null) {
        output = 0;
      }
      if (input == null) {
        input = 0;
      }
      switch (this.__typeof(node1)) {
        case "MooogAudioNode":
          source = node1._nodes[node1._nodes.length - 1];
          break;
        case "AudioNode":
        case "AudioParam":
          source = node1;
          break;
        case "string":
          source = this._instance.node(node1);
          break;
        default:
          throw new Error("Unknown node type passed to disconnect");
      }
      switch (this.__typeof(node2)) {
        case "MooogAudioNode":
          target = node2._nodes[0];
          break;
        case "AudioNode":
        case "AudioParam":
          target = node2;
          break;
        case "string":
          target = this._instance.node(node2);
          break;
        default:
          throw new Error("Unknown node type passed to disconnect");
      }
      try {
        source.disconnect(target, output, input);
      } catch (_error) {
        e = _error;
        this.debug("ignored InvalidAccessError disconnecting " + target + " from " + source);
      }
      return this;
    };

    MooogAudioNode.prototype.disconnect = function(node, output, input) {
      if (output == null) {
        output = 0;
      }
      if (input == null) {
        input = 0;
      }
      return this.safely_disconnect(this, node, output, input);
    };

    MooogAudioNode.prototype.param = function(key, val) {
      var k, v;
      if (this.__typeof(key) === 'object') {
        for (k in key) {
          v = key[k];
          this.get_set(k, v);
        }
        return this;
      }
      return this.get_set(key, val);
    };

    MooogAudioNode.prototype.get_set = function(key, val) {
      if (this[key] == null) {
        return;
      }
      switch (this.__typeof(this[key])) {
        case "AudioParam":
          if (val != null) {
            this[key].setValueAtTime(val, this.context.currentTime);
            return this;
          } else {
            return this[key].value;
          }
          break;
        default:
          if (val != null) {
            this[key] = val;
            return this;
          } else {
            return this[key];
          }
      }
    };

    MooogAudioNode.prototype.define_buffer_source_properties = function() {
      this._buffer_source_file_url = '';
      return Object.defineProperty(this, 'buffer_source_file', {
        get: function() {
          return this._buffer_source_file_url;
        },
        set: (function(_this) {
          return function(filename) {
            var request;
            request = new XMLHttpRequest();
            request.open('GET', filename, true);
            request.responseType = 'arraybuffer';
            request.onload = function() {
              _this.debug("loaded " + filename);
              _this._buffer_source_file_url = filename;
              return _this._instance.context.decodeAudioData(request.response, function(buffer) {
                _this.debug("setting buffer", buffer);
                return _this.buffer = buffer;
              }, function(error) {
                throw new Error("Could not decode audio data from " + request.responseURL + " - unsupported file format?");
              });
            };
            return request.send();
          };
        })(this),
        enumerable: true,
        configurable: true
      });
    };

    MooogAudioNode.prototype.define_readonly_property = function(prop_name, func) {
      return Object.defineProperty(this, prop_name, {
        get: func,
        set: function() {
          throw new Error(this + "." + prop_name + " is read-only");
        },
        enumerable: true,
        configurable: false
      });
    };

    MooogAudioNode.prototype.adsr = function(param, config) {
      var _0, a, base, ramp, s, t, times;
      if (typeof param === "string") {
        param = this[param];
      }
      _0 = this._instance.config.fake_zero;
      base = config.base, times = config.times, a = config.a, s = config.s;
      if (base == null) {
        base = _0;
      }
      if (base === 0) {
        base = _0;
      }
      if (a == null) {
        a = 1;
      }
      if (a === 0) {
        a = _0;
      }
      if (s == null) {
        s = 1;
      }
      if (s === 0) {
        s = _0;
      }
      t = this.context.currentTime;
      times[0] || (times[0] = _0);
      times[1] || (times[1] = _0);
      if (times.length > 2) {
        times[2] || (times[2] = _0);
      }
      if (times.length > 3) {
        times[3] || (times[3] = _0);
      }
      if (config.ramp_type == null) {
        config.ramp_type = this._instance.config.default_ramp_type;
      }
      switch (config.ramp_type) {
        case 'linear':
          ramp = param.linearRampToValueAtTime.bind(param);
          break;
        case 'exponential':
          ramp = param.exponentialRampToValueAtTime.bind(param);
      }
      this.debug("times", times);
      if (times.length === 2) {
        param.cancelScheduledValues(t);
        param.setValueAtTime(base, t);
        ramp(a, t + times[0]);
        return ramp(s, t + times[0] + times[1]);
      } else if (times.length === 3) {
        param.cancelScheduledValues(t);
        param.setValueAtTime(base, t);
        ramp(a, t + times[0]);
        param.setValueAtTime(a, t + times[0] + times[1]);
        return ramp(base, t + times[0] + times[1] + times[2]);
      } else {
        param.cancelScheduledValues(t);
        param.setValueAtTime(base, t);
        ramp(a, t + times[0]);
        ramp(s, t + times[0] + times[1]);
        param.setValueAtTime(s, t + times[0] + times[1] + times[2]);
        return ramp(base, t + times[0] + times[1] + times[2] + times[3]);
      }
    };

    MooogAudioNode.prototype.debug = function() {
      var a;
      a = 1 <= arguments.length ? slice.call(arguments, 0) : [];
      if (this._instance.config.debug) {
        return console.log.apply(console, a);
      }
    };

    return MooogAudioNode;

  })();

  Analyser = (function(superClass) {
    extend(Analyser, superClass);

    function Analyser(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      config.node_type = 'Analyser';
      Analyser.__super__.constructor.apply(this, arguments);
      this.configure_from(config);
      this.insert_node(this.context.createAnalyser(), 0);
      this.zero_node_setup(config);
    }

    return Analyser;

  })(MooogAudioNode);

  AudioBufferSource = (function(superClass) {
    extend(AudioBufferSource, superClass);

    function AudioBufferSource(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      config.node_type = 'AudioBufferSource';
      AudioBufferSource.__super__.constructor.apply(this, arguments);
      this.configure_from(config);
      this.insert_node(this.context.createBufferSource(), 0);
      this.define_buffer_source_properties();
      this.zero_node_setup(config);
      this.insert_node(new Gain(this._instance, {
        gain: 1.0,
        connect_to_destination: this.config.connect_to_destination
      }));
      this._is_started = false;
      this._stop_timeout = false;
      this._state = 'stopped';
      this.define_readonly_property('state', (function(_this) {
        return function() {
          return _this._state;
        };
      })(this));
      this._true_loop = this._nodes[0].loop;
      this._nodes[0].loop = true;
      this._true_loopStart = this._nodes[0].loopStart;
      this._true_loopEnd = this._nodes[0].loopEnd;
      Object.defineProperty(this, 'loop', {
        get: function() {
          return this._true_loop;
        },
        set: (function(_this) {
          return function(val) {
            _this._true_loop = val;
            if (_this._state === 'playing') {
              if (val) {
                _this._nodes[0].loopEnd = _this._true_loopEnd;
                return _this._nodes[0].loopStart = _this._true_loopStart;
              } else {
                _this._true_loopEnd = _this._nodes[0].loopEnd;
                return _this._true_loopStart = _this._nodes[0].loopStart;
              }
            }
          };
        })(this),
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(this, 'loopStart', {
        get: function() {
          return this._true_loopStart;
        },
        set: (function(_this) {
          return function(val) {
            _this._true_loopStart = val;
            if (_this._true_loop && _this._state === 'playing') {
              return _this._nodes[0].loopStart = _this._true_loopStart;
            }
          };
        })(this),
        enumerable: true,
        configurable: true
      });
      Object.defineProperty(this, 'loopEnd', {
        get: function() {
          return this._true_loopEnd;
        },
        set: (function(_this) {
          return function(val) {
            _this._true_loopEnd = val;
            if (_this._true_loop && _this._state === 'playing') {
              return _this._nodes[0].loopEnd = _this._true_loopEnd;
            }
          };
        })(this),
        enumerable: true,
        configurable: true
      });
    }

    AudioBufferSource.prototype.start = function() {
      if (this._state === 'playing') {
        return;
      }
      this._state = 'playing';
      if (this._true_loop) {
        this._nodes[0].loopEnd = this._true_loopEnd;
        this._nodes[0].loopStart = this._true_loopStart;
      } else {
        this._nodes[0].loopEnd = this._nodes[0].buffer.duration;
        this._nodes[0].loopStart = 0;
        this._stop_timeout = setTimeout(this.stop.bind(this), (Math.round(this._nodes[0].buffer.duration * 1000)) - 19);
      }
      if (this._is_started) {
        this._nodes[1].gain.value = 1.0;
      } else {
        this._nodes[0].start();
        this._is_started = true;
      }
      return this;
    };

    AudioBufferSource.prototype.stop = function() {
      if (this._state === 'stopped') {
        return;
      }
      this._state = 'stopped';
      clearTimeout(this._stop_timeout);
      this._nodes[1].gain.value = 0;
      this._nodes[0].loopStart = 0;
      this._nodes[0].loopEnd = 0.005;
      return this;
    };

    return AudioBufferSource;

  })(MooogAudioNode);

  BiquadFilter = (function(superClass) {
    extend(BiquadFilter, superClass);

    function BiquadFilter(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      config.node_type = 'BiquadFilter';
      BiquadFilter.__super__.constructor.apply(this, arguments);
      this.configure_from(config);
      this.insert_node(this.context.createBiquadFilter(), 0);
      this.zero_node_setup(config);
    }

    return BiquadFilter;

  })(MooogAudioNode);

  Convolver = (function(superClass) {
    extend(Convolver, superClass);

    function Convolver(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      config.node_type = 'Convolver';
      Convolver.__super__.constructor.apply(this, arguments);
      this.configure_from(config);
      this.insert_node(this.context.createConvolver(), 0);
      this.define_buffer_source_properties();
      this.zero_node_setup(config);
    }

    return Convolver;

  })(MooogAudioNode);

  Delay = (function(superClass) {
    extend(Delay, superClass);

    function Delay(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      config.node_type = 'Delay';
      Delay.__super__.constructor.apply(this, arguments);
      this.configure_from(config);
      this.insert_node(this.context.createDelay(), 0);
      this._feedback_stage = new Gain(this._instance, {
        connect_to_destination: false,
        gain: 0.99
      });
      this._nodes[0].connect(this.to(this._feedback_stage));
      this._feedback_stage.connect(this.to(this._nodes[0]));
      this.feedback = this._feedback_stage.gain;
      this.zero_node_setup(config);
    }

    return Delay;

  })(MooogAudioNode);

  DynamicsCompressor = (function(superClass) {
    extend(DynamicsCompressor, superClass);

    function DynamicsCompressor(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      config.node_type = 'DynamicsCompressor';
      DynamicsCompressor.__super__.constructor.apply(this, arguments);
      this.configure_from(config);
      this.insert_node(this.context.createDynamicsCompressor(), 0);
      this.zero_node_setup(config);
    }

    return DynamicsCompressor;

  })(MooogAudioNode);

  Gain = (function(superClass) {
    extend(Gain, superClass);

    function Gain(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      config.node_type = 'Gain';
      Gain.__super__.constructor.apply(this, arguments);
      this.configure_from(config);
      this.insert_node(this.context.createGain(), 0);
      this._nodes[0].gain.value = this._instance.config.default_gain;
      this.zero_node_setup(config);
    }

    return Gain;

  })(MooogAudioNode);

  Oscillator = (function(superClass) {
    extend(Oscillator, superClass);

    function Oscillator(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      config.node_type = 'Oscillator';
      Oscillator.__super__.constructor.apply(this, arguments);
      this.configure_from(config);
      this.insert_node(this.context.createOscillator(), 0);
      this.zero_node_setup(config);
      this.insert_node(new Gain(this._instance, {
        connect_to_destination: this.config.connect_to_destination
      }));
      this._is_started = false;
      this._state = 'stopped';
      this.define_readonly_property('state', (function(_this) {
        return function() {
          return _this._state;
        };
      })(this));
    }

    Oscillator.prototype.start = function() {
      if (this._state === 'playing') {
        return;
      }
      this._state = 'playing';
      if (this._is_started) {
        this._nodes[1].gain.value = 1.0;
      } else {
        this._nodes[0].start();
        this._is_started = true;
      }
      return this;
    };

    Oscillator.prototype.stop = function() {
      if (this._state === 'stopped') {
        return;
      }
      this._state = 'stopped';
      this._nodes[1].gain.value = 0;
      return this;
    };

    return Oscillator;

  })(MooogAudioNode);

  StereoPanner = (function(superClass) {
    extend(StereoPanner, superClass);

    function StereoPanner(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      config.node_type = 'StereoPanner';
      StereoPanner.__super__.constructor.apply(this, arguments);
      this.configure_from(config);
      this.insert_node(this.context.createStereoPanner(), 0);
      this.zero_node_setup(config);
    }

    return StereoPanner;

  })(MooogAudioNode);

  WaveShaper = (function(superClass) {
    extend(WaveShaper, superClass);

    function WaveShaper(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      config.node_type = 'WaveShaper';
      WaveShaper.__super__.constructor.apply(this, arguments);
      this.configure_from(config);
      this.insert_node(this.context.createWaveShaper(), 0);
      this.zero_node_setup(config);
    }

    return WaveShaper;

  })(MooogAudioNode);

  Track = (function(superClass) {
    extend(Track, superClass);

    function Track(_instance, config) {
      this._instance = _instance;
      if (config == null) {
        config = {};
      }
      this._sends = {};
      this.debug('initializing track object');
      config.node_type = 'Track';
      Track.__super__.constructor.apply(this, arguments);
      this.configure_from(config);
      this._pan_stage = this._instance.context.createStereoPanner();
      this._gain_stage = this._instance.context.createGain();
      this._gain_stage.gain.value = this._instance.config.default_gain;
      this._pan_stage.connect(this._gain_stage);
      this._gain_stage.connect(this._destination);
      this._destination = this._pan_stage;
      this.gain = this._gain_stage.gain;
      this.pan = this._gain_stage.gain;
      this.zero_node_setup(config);
    }

    Track.prototype.send = function(id, dest, pre, gain) {
      var source;
      if (pre == null) {
        pre = this._instance.config.default_send_type;
      }
      if (gain == null) {
        gain = this._instance.config.default_gain;
      }
      if (dest == null) {
        return this._sends[id];
      }
      source = pre === 'pre' ? this._nodes[this._nodes.length - 1] : this._gain_stage;
      gain = this._sends[id] ? this._sends[id] : new Gain(this._instance, {
        connect_to_destination: false,
        gain: gain
      });
      source.connect(this.to(gain));
      gain.connect(this.to(dest));
      return gain;
    };

    return Track;

  })(MooogAudioNode);

  Mooog = (function() {
    Mooog.LEGAL_NODES = {
      'Oscillator': Oscillator,
      'StereoPanner': StereoPanner,
      'Gain': Gain,
      'AudioBufferSource': AudioBufferSource,
      'Convolver': Convolver,
      'BiquadFilter': BiquadFilter,
      'Analyser': Analyser,
      'DynamicsCompressor': DynamicsCompressor,
      'Delay': Delay,
      'WaveShaper': WaveShaper
    };

    function Mooog(initConfig1) {
      this.initConfig = initConfig1 != null ? initConfig1 : {};
      this._BROWSER_CONSTRUCTOR = false;
      this.context = this.create_context();
      this._destination = this.context.destination;
      this.config = {
        debug: false,
        default_gain: 0.5,
        default_ramp_type: 'exponential',
        default_send_type: 'post',
        periodic_wave_length: 2048,
        fake_zero: 1 / 32768
      };
      this.init(this.initConfig);
      this._nodes = {};
    }

    Mooog.prototype.init = function(initConfig) {
      var key, ref, results, val;
      ref = this.config;
      results = [];
      for (key in ref) {
        val = ref[key];
        if (initConfig[key] != null) {
          results.push(this.config[key] = initConfig[key]);
        } else {
          results.push(void 0);
        }
      }
      return results;
    };

    Mooog.prototype.create_context = function() {
      if ((window.AudioContext != null)) {
        this._BROWSER_CONSTRUCTOR = 'AudioContext';
        return new AudioContext();
      }
      if ((window.webkitAudioContext != null)) {
        this._BROWSER_CONSTRUCTOR = 'webkitAudioContext';
        return new webkitAudioContext();
      }
      throw new Error("This browser does not yet support the AudioContext API");
    };

    Mooog.prototype.track = function() {
      var id, node_list, ref;
      id = arguments[0], node_list = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      if (!arguments.length) {
        return new Track(this);
      }
      if (typeof id === 'string') {
        if (node_list.length) {
          if (this._nodes[id] != null) {
            throw new Error(id + " is already assigned to " + this._nodes[id]);
          }
          this._nodes[id] = new Track(this, {
            id: id
          });
          this._nodes[id].add(node_list);
          return this._nodes[id];
        } else if (((ref = this._nodes) != null ? ref[id] : void 0) != null) {
          return this._nodes[id];
        } else {
          throw new Error("No Track found with id " + id);
        }
      } else {
        throw new Error("Track id must be a string");
      }
    };

    Mooog.prototype.node = function() {
      var id, node, node_list, ref, ref1;
      id = arguments[0], node_list = 2 <= arguments.length ? slice.call(arguments, 1) : [];
      if (!arguments.length) {
        return new MooogAudioNode(this);
      }
      if (typeof id === 'string') {
        if (node_list.length) {
          if (this._nodes[id] != null) {
            throw new Error(id + " is already assigned to " + this._nodes[id]);
          }
          return this._nodes[id] = (function(func, args, ctor) {
            ctor.prototype = func.prototype;
            var child = new ctor, result = func.apply(child, args);
            return Object(result) === result ? result : child;
          })(MooogAudioNode, [this, id].concat(slice.call(node_list)), function(){});
        } else if (((ref = this._nodes) != null ? ref[id] : void 0) != null) {
          return this._nodes[id];
        } else {
          throw new Error("No MooogAudioNode found with id " + id);
        }
      } else {
        node = (function(func, args, ctor) {
          ctor.prototype = func.prototype;
          var child = new ctor, result = func.apply(child, args);
          return Object(result) === result ? result : child;
        })(MooogAudioNode, [this].concat(slice.call((ref1 = [id]).concat.apply(ref1, node_list))), function(){});
        return this._nodes[node.id] = node;
      }
    };

    Mooog.freq = function(n) {
      return 440 * Math.pow(2, (n - 69) / 12);
    };

    Mooog.prototype.sawtoothPeriodicWave = function(harms) {
      var a, i, imag, j, real, ref;
      if (harms == null) {
        harms = this.config.periodic_wave_length;
      }
      a = [0];
      for (i = j = 1, ref = harms - 1; 1 <= ref ? j <= ref : j >= ref; i = 1 <= ref ? ++j : --j) {
        a.push(1 / i);
      }
      real = new Float32Array(a);
      imag = new Float32Array(real.length);
      return this.context.createPeriodicWave(real, imag);
    };

    Mooog.prototype.squarePeriodicWave = function(harms) {
      var a, i, imag, j, real, ref;
      if (harms == null) {
        harms = this.config.periodic_wave_length;
      }
      a = [0];
      for (i = j = 1, ref = harms - 1; 1 <= ref ? j <= ref : j >= ref; i = 1 <= ref ? ++j : --j) {
        if (i % 2 !== 0) {
          a.push(2 / (Math.PI * i));
        } else {
          a.push(0);
        }
      }
      real = new Float32Array(a);
      imag = new Float32Array(real.length);
      return this.context.createPeriodicWave(real, imag);
    };

    Mooog.prototype.trianglePeriodicWave = function(harms) {
      var a, i, imag, j, real, ref;
      if (harms == null) {
        harms = this.config.periodic_wave_length;
      }
      a = [0];
      for (i = j = 1, ref = harms - 1; 1 <= ref ? j <= ref : j >= ref; i = 1 <= ref ? ++j : --j) {
        if (i % 2 !== 0) {
          a.push(1 / (Math.pow(i, 2)));
        } else {
          a.push(0);
        }
      }
      real = new Float32Array(a);
      imag = new Float32Array(real.length);
      return this.context.createPeriodicWave(real, imag);
    };

    Mooog.prototype.sinePeriodicWave = function(harms) {
      var a, imag, real;
      a = [0, 1];
      real = new Float32Array(a);
      imag = new Float32Array(real.length);
      return this.context.createPeriodicWave(real, imag);
    };

    return Mooog;

  })();

  window.Mooog = Mooog;

}).call(this);
