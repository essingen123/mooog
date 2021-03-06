## MooogAudioNode

Base class for all the node wrappers. 

The MooogAudioNode object wraps one or more AudioNode objects. By default it 
exposes the `AudioNode` methods of the first AudioNode in the `_nodes`
array. 


> MooogAudioNode(instance:Mooog , node_definition:object)

`_instance`: The parent `Mooog` instance  
`node_definition`: Either a string representing the type of Node to initialize
or an object with initialization params (see below) 

Required properties:
  - `node_type`: String indicating the type of Node (Oscillator, Gain, etc.)
  
Optional properties for all nodes
  - `id`: Unique string identifier, will be created programatically if not given.
  - `connect_to_destination`: Boolean indicating whether the last in this node's 
`_nodes` array is automatically connected to the `AudioDestinationNode`. *default: true*

Additional properties  
  - Any additional key-value pairs will be used to set properties of the underlying `AudioNode`
object after initialization. 



    class MooogAudioNode
      constructor: (@_instance, config) ->
        @_destination = @_instance._destination
        @context = @_instance.context
        @_nodes = []
        @config_defaults =
          connect_to_destination: true
        @config = {}
        @_connections = []
        @_exposed_properties = {}
                
        
        if @constructor.name is "MooogAudioNode"
          if Mooog.LEGAL_NODES[config.node_type]?
            return new Mooog.LEGAL_NODES[config.node_type] @_instance, config
          else
            throw new Error("Omitted or undefined node type in config options.")
        else
          @configure_from config
          @before_config config
          @zero_node_setup config
          @after_config config
        
        

### MooogAudioNode.configure_from
The config object can contain general configuration options or key/value pairs to be set on the
wrapped `AudioNode`. This function merges the config defaults with the supplied options and sets
the `config` property of the node
      
      configure_from: (ob) ->
        @node_type = if ob.node_type? then ob.node_type else @constructor.name
        @id = if ob.id? then ob.id else @new_id()
        for k, v of @config_defaults
          @config[k] = if (k of ob) then ob[k] else @config_defaults[k]
        @config


### MooogAudioNode.zero_node_settings
XORs the supplied configuration object with the defaults to return an object the properties of which
should be set on the zero node
      
      zero_node_settings: (ob) ->
        zo = {}
        for k, v of ob
          zo[k] = v unless k of @config_defaults or k is 'node_type' or k is 'id'
        zo
        

### MooogAudioNode.zero_node_setup
Runs after the MooogAudioNode constructor by the inheriting classes. Exposes the underlying
`AudioNode` properties and sets any `AudioNode`-specific properties supplied in the 
configuration object.
      
      zero_node_setup: (config) ->
        @expose_properties_of @_nodes[0] if @_nodes[0]?
        for k, v of @zero_node_settings(config)
          @debug "zero node settings, #{k} = #{v}"
          @param k, v
        
### MooogAudioNode.toString
Includes the ID in the string representation of the object.      

      toString: () ->
        "#{@node_type}#"+@id



### MooogAudioNode.new_id
Generates a new string identifier for this node.
      
      
      new_id: () ->
        "#{@node_type}_#{Math.round(Math.random()*100000)}"


### MooogAudioNode.__typeof
This is a modified `typeof` to filter AudioContext API-specific object types
      
      
      __typeof: (thing) ->
        return "AudioParam" if thing instanceof AudioParam
        return "AudioNode" if thing instanceof AudioNode
        return "AudioBuffer" if thing instanceof AudioBuffer
        return "PeriodicWave" if thing instanceof PeriodicWave
        return "AudioListener" if thing instanceof AudioListener
        return "Track" if thing instanceof Track
        return "MooogAudioNode" if thing instanceof MooogAudioNode
        return typeof(thing)

      
### MooogAudioNode.insert_node

      #todo: deal with exposing node properties at ordinal 0
      insert_node: (node, ord) ->
        length = @_nodes.length
        ord = length unless ord?
        

        node.disconnect node._destination if node._destination?
                
        if ord > length
          throw new Error("Invalid index given to insert_node: " + ord +
          " out of " + length)
        @debug "insert_node of #{@} for", node, ord

        if ord is 0
          @connect_incoming node
          @disconnect_incoming @_nodes[0]

          if length > 0
            node.connect @to @_nodes[0]
            @debug '- node.connect to ', @_nodes[0]

        if ord is length
          @safely_disconnect @_nodes[ord - 1], (@from @_destination) if ord isnt 0
          @debug("- disconnect ", @_nodes[ord - 1], 'from', @_destination) if ord isnt 0
          
          if @config.connect_to_destination
            node.connect @to @_destination
            @debug '- connect', node, 'to', @_destination
          
          @_nodes[ord - 1].connect @to node if ord isnt 0
          @debug '- connect', @_nodes[ord - 1], "to", node if ord isnt 0

        if ord isnt length and ord isnt 0
          @safely_disconnect @_nodes[ord - 1], (@from @_nodes[ord])
          @debug "- disconnect", @_nodes[ord - 1], "from", @_nodes[ord]
          @_nodes[ord - 1].connect @to node
          @debug "- connect", @_nodes[ord - 1], "to", node
          node.connect @to @_nodes[ord]
          @debug "- connect", node, "to", @_nodes[ord]
        
        @_nodes.splice ord, 0, node
        @debug "- spliced:", @_nodes
        


### MooogAudioNode.delete_node


      delete_node: (ord) ->
        #todo: use the @_connections list
        return unless ord?
        length = @_nodes.length
        
                
        if ord > (length - 1)
          throw new Error("Invalid index given to delete_node: " + ord +
          " out of " + length)
        @debug "delete of #{@} for position", ord

        if ord isnt 0
          @safely_disconnect @_nodes[ord - 1], (@from @_nodes[ord])
          
        if ord < (length - 1)
          @safely_disconnect @_nodes[ord], (@from @_nodes[ord + 1])
          
        if ord is (length - 1)
          @safely_disconnect @_nodes[ord], (@from @_destination)
          
        del = @_nodes.splice ord, 1
        delete del[0]
        @debug "remove node at index #{ord}"
        
  
### MooogAudioNode.add
Shortcut for insert_node


      add: (nodes) ->
        nodes = [nodes] unless nodes instanceof Array
        for i in nodes
          switch @__typeof i
            when "MooogAudioNode" then @insert_node(i)
            when "object" then @insert_node( @_instance.node i )
            else throw new Error("Unknown argument type (should be config object or MooogAudioNode)")
          

      connect_incoming: ->
        #@debug 'do incoming'
        #todo: deal with incoming connections for 0 element

      disconnect_incoming: ->
        #@debug 'undo incoming'
        #todo: deal with incoming connections for 0 element


### MooogAudioNode.connect
`node`: The node object or string ID of the object to which to connect.  
`param`: Optional string name of the `AudioParam` member of `node` to
which to connect.  
`output`: Optional integer representing the output of this Node to use.  
`input`: If `param` is not specified (you are connecting to an `AudioNode`)
then this integer argument can be used to specify the input of the target
to connect to.  



      connect: (node, output = 0, input = 0, return_this = true) ->
        @debug "called connect from #{@} to #{node}, #{output}"
        
        switch @__typeof node
          
          when "AudioParam"
            @_nodes[ @_nodes.length - 1 ].connect node, output
            return this
          when "string"
            node = @_instance.node node
            target = node._nodes[0]
          when "MooogAudioNode", "Track"
            target = node._nodes[0]
          when "AudioNode"
            target = node
          else throw new Error "Unknown node type #{@__typeof node} passed to connect"
          
        @_connections.push [node, output, input]
        
        source = if this instanceof Track then @_gain_stage else @_nodes[ @_nodes.length - 1 ]
        
        switch
          when typeof(output) is 'string' #connecting to AudioParam
            source.connect target[output], input
          when typeof(output) is 'number' #connecting to a Node
            source.connect target, output, input
        
        return if return_this then this else node



### MooogAudioNode.chain
Like `MooogAudioNode.connect` with two important differences. First, it returns the 
`MooogAudioNode` you are connecting to. Second, it automatically disconnects the calling
`MooogAudioNode` from the context's `AudioDestinationNode`. To use with `AudioParam`s, 
use the name of the param as the second argument (and the base `MooogAudioNode` as the first).

      chain: (node, output = 0, input = 0) ->
        if @__typeof(node) is "AudioParam" and typeof(output) isnt 'string'
          throw new Error "MooogAudioNode.chain() can only target AudioParams when used with
          the signature .chain(target_node:Node, target_param_name:string)"
        destination = if this instanceof Track then @_instance._destination else @_destination
        @disconnect destination
        @connect node, output, input, false


### MooogAudioNode.to, MooogAudioNode.from
These functions are synonyms and exist to improve code readability in the `connect`
and `disconnect` functions.
      
      to: (node) ->
        switch @__typeof node
          when "MooogAudioNode", "Track" then return node._nodes[0]
          when "AudioNode" then return node
          else throw new Error "Unknown node type #{@__typeof node} passed to connect"
      
      from: @.prototype.to
      

### MooogAudioNode.expose_properties_of
Exposes the properties of a wrapped `AudioNode` on `this`. Will not overwrite properties
of `this` unless they were created by a previous call to the function.

      
      expose_properties_of: (node) ->
        @debug "exposing", node
        for key,val of node
          if @[key]? and !@_exposed_properties[key] then continue
          @expose_property node, key
        node
        
        
### MooogAudioNode.expose_property
Worker function for expose_properties_of, also used in plugins. 
     
      expose_property: (node, key) ->
        @_exposed_properties[key] = true
        val = node[key]
        switch @__typeof val
          when 'function'
            @[key] = val.bind node
          when 'AudioParam'
            @[key] = val
          when "string", "number", "boolean", "object"
            ((o, node, key) ->
              Object.defineProperty o, key, {
                get: ->
                  node[key]
                set: (val) ->
                  node[key] = val
                enumerable: true
                configurable: true
              })(@, node, key)
        key
 
      
      



### MooogAudioNode.safely_disconnect
Prevents `InvalidAccessError`s from stopping program execution if you try to use disconnect on 
a node that's not already connected.

      safely_disconnect: (node1, node2, output = 0, input = 0) ->
        switch @__typeof node1
          when "MooogAudioNode" then source = node1._nodes[ node1._nodes.length - 1 ]
          when "AudioNode", "AudioParam" then source = node1
          when "Track" then source = node1._gain_stage
          when "string" then source = @_instance.node node1
          else throw new Error "Unknown node type passed to disconnect"
        switch @__typeof node2
          when "MooogAudioNode", "Track" then target = node2._nodes[0]
          when "AudioNode", "AudioParam" then target = node2
          when "string" then target = @_instance.node node2
          else throw new Error "Unknown node type passed to disconnect"
        try
          @debug "Disconnecting ", source, target
          source.disconnect target, output, input
        catch e
          @debug("ignored InvalidAccessError disconnecting #{target} from #{source}")
        @

      
### MooogAudioNode.disconnect
Replace the native `disconnect` function with a safe version, in case it is called directly.

      disconnect: (node, output = 0, input = 0) ->
        @safely_disconnect @, node, output, input



### MooogAudioNode.param
jQuery-style getter/setter that also works on `AudioParam` properties. Signatures:

> param( key:string [, value:mixed])

With two arguments, the first is taken as the property to get or set. If there's a 
second property it's used to set the value. 

> MooogAudioNode( { key: value [, key: value]... [, ramp: rampType:mixed]
[,&nbsp;at:float ] [,&nbsp;duration:float] [,&nbsp;timeConstant:float] [, cancel:boolean] 
[, from_now:boolean]  } )


When passed an object, the properties of the object are used to set values on `this`.
`AudioParam` parameters are set immediately by default using `setValueAtTime`. 
This behavior can be changed by setting additional properties on the object. 
- To use `linearRampToValueAtTime`, `exponentialRampToValueAtTime`, the `ramp` property 
can be used in conjunction with the `at` property which desribes the time at which to make 
the change:  
`ramp`: An enumerated string: 'none', 'linear', 'expo', 'curve'.  *Defaults to 'none'*
`at`: A float representing a number of seconds in the future at which to arrive at
or start the changes, depending on the ramp function.  
`from_now`: A boolean indicating whether the start of value changes via `linearRampToValueAtTime`
and `exponentialRampToValueAtTime` occurs now or after the previous value change. Internally,
setting this to true calls setValueAtTime using the parameter's current value and the 
current time. In order to ensure that param.value reflects previous changes to the
parameter made on this tick, the setValueAtTime and subequent ramp function calls
are delayed by 1 sample or the minimum setTimeout value for the browser, whichever is larger. 
If you really need the ramp to start at the current time, use param(key, value) to set the
current value and then call param(), omitting `from_now` which *defaults to false*
`cancel`: whether to call `cancelScheduledValues` before setting the parameter(s). 
*Defaults to false* 
- To use `setValueCurveAtTime`, `ramp` should be set to `curve` and the `duration` property 
must be set. Value arrays are automatically coerced to Float32Array types.
`duration`: The length of time to fill with the value changes in the arrays.  
- To use `setTargetAtTime` instead of `exponentialRampToValueAtTime`, set `ramp` to `expo`
but supply a `timeConstant`. *Defaults to true*
  
      param: (key, val) ->
        if @__typeof(key) is 'object'
          at = parseFloat(key.at) || 0
          timeConstant = if key.timeConstant? then parseFloat(key.timeConstant) else false
          duration = if key.duration then parseFloat(key.duration) else false
          cancel = !!key.cancel
          from_now = !!key.from_now
          switch key.ramp
            when "linear" then [rampfun, extra] = ["linearRampToValueAtTime", false]
            when "curve" then [rampfun, extra] = ["setValueCurveAtTime", duration]
            when "expo"
              if timeConstant
                [rampfun, extra] = ["setTargetAtTime", timeConstant]
              else
                [rampfun, extra] = ["exponentialRampToValueAtTime", false]
            else [rampfun, extra] = ["setValueAtTime", false]
          @get_set k, v, rampfun, at, cancel, from_now, extra for k, v of key
          return this
        return @get_set key, val, 'setValueAtTime', 0, true



### MooogAudioNode.get_set
Handles the getting/setting for `MooogAudioNode.param`. Uses setValueAtTime
when dealing with `AudioParam`s to make sure changes are made, and immediate.
See [https://jsfiddle.net/5xqhwzwu/1/](https://jsfiddle.net/5xqhwzwu/). See the
`param` definition for the arguments.

      get_set: (key, val, rampfun, at, cancel, from_now, extra) ->
        return unless @[key]? or @hasOwnProperty(key)
        switch @__typeof @[key]
          when "AudioParam"
            if val?
              @[key].cancelScheduledValues(0) if cancel
              @debug "#{key}.cancelScheduledValues(0)" if cancel
              val = @_instance.config.fake_zero if val is 0 and rampfun in ["setTargetAtTime", "exponentialRampToValueAtTime"]
              val = new Float32Array val if val instanceof Array
              switch rampfun
                when "linearRampToValueAtTime", "exponentialRampToValueAtTime"
                  if from_now
                    setTimeout( (()=>
                      @[key].setValueAtTime(@[key].value, @context.currentTime)
                      @debug "#{key}.setValueAtTime(#{@[key].value}, #{@context.currentTime})"
                      @[key][rampfun] val, @context.currentTime + at
                      @debug "#{key}.#{rampfun}(#{val}, \
                      #{@context.currentTime + at})"), 1000 / @context.sampleRate  )
                  else
                    @[key][rampfun] val, @context.currentTime + at
                when "setValueAtTime"
                  @[key][rampfun] val, @context.currentTime + at
                  @debug "#{key}.#{rampfun}(#{val}, \
                  #{@context.currentTime + at})"
                when "setValueCurveAtTime"
                  @[key][rampfun] val, @context.currentTime + at, extra
                  @debug "#{key}.#{rampfun}(#{val}, \
                  #{@context.currentTime + at}, #{extra})"
                when "setTargetAtTime"
                  @[key][rampfun] val, @context.currentTime + at, extra
                  @debug "#{key}.#{rampfun}(#{val}, \
                  #{@context.currentTime + at}, #{extra})"
              return this
            else
              @[key].value
          else
            if val?
              @[key] = val
              return this
            else @[key]


### MooogAudioNode.define_buffer_source_properties
Sets up useful functions on `MooogAudioNode`s that have a `buffer` property. To prevent
multiple HTTP requests for the same file on load, all buffers are tracked in the parent
instance and used if available there. If an audio asset has already been requested by
another bufferNode, this node will wait for the loaded event and then load it from the
shared buffer hash in the parent instance.
   
      
      define_buffer_source_properties: () ->
        @_buffer_source_file_url = ''
        Object.defineProperty @, 'buffer_source_file', {
          get: ->
            @_buffer_source_file_url
          set: @set_buffer_source_file.bind this
          enumerable: true
          configurable: true
        }
        null


      
### MooogAudioNode.set_buffer_source_file
Setter for the `buffer` property.  Used in `define_buffer_source_properties` and 
as a handler for the audioBufferLoaded event. 

      
      set_buffer_source_file: (filename, event=false) =>
        if @_instance.audioBuffersLoaded[filename]
          if @_instance.audioBuffersLoaded[filename] is "REQUESTED"
            @debug "#{filename} requested but not yet available to #{@id}, adding event listener"
            deferredLoad = (filename, event)->
              if event.detail.filename is filename
                @debug "deferred load callback for #{filename}"
                @buffer = @_instance.audioBuffersLoaded[filename]
                document.removeEventListener Mooog.EVENT_NAMES.AUDIO_BUFFER_LOADED, deferredLoad
            document.addEventListener Mooog.EVENT_NAMES.AUDIO_BUFFER_LOADED, deferredLoad.bind this, filename
                
          else
            @buffer = @_instance.audioBuffersLoaded[filename]
            @debug "set buffer #{filename} from cache for #{@id}"
            return null
        else
          @debug "#{filename} not in cache, requesting for #{@id}"
          @_instance.audioBuffersLoaded[filename] = "REQUESTED"
          request = new XMLHttpRequest()
          request.open('GET', filename, true)
          request.responseType = 'arraybuffer'
          request.onload = () =>
            @debug "completed HTTP request for #{filename}"
            @_buffer_source_file_url = filename
            @_instance.context.decodeAudioData request.response, (buffer) =>
              @debug "setting buffer from #{filename} and dispatching #{Mooog.EVENT_NAMES.AUDIO_BUFFER_LOADED}",buffer
              @_instance.audioBuffersLoaded[filename] = buffer
              @buffer = buffer
              event = new CustomEvent Mooog.EVENT_NAMES.AUDIO_BUFFER_LOADED,
                detail:
                  filename: filename
                  buffer: buffer
              document.dispatchEvent event
            , (error) ->
              throw new Error("Could not decode audio data from #{request.responseURL}
               - unsupported file format?")
          request.send()
        
      
        
### MooogAudioNode.define_readonly_property

        
      define_readonly_property: (prop_name, func) ->
        Object.defineProperty @, prop_name, {
          get: func
          set: () ->
            throw new Error("#{@}.#{prop_name} is read-only")
          enumerable: true
          configurable: false
        }
        
        
### MooogAudioNode.adsr
Applies an ADSR, ASR, or ADS envelope of value changes to an `AudioParam`.  
`param`: An `AudioParam` or a string representing the name of the property, assumed to be on `this`.  
`config`: Object with the following properties (fake_zero is a very small number 
used in place of actual zero, which will throw errors when passed to 
`exponentialRampToValueAtTime`).  
  - base: The value to start and end with. *Defaults to 'zero'*
  - times: An array of time values representing the ending time of each of the 
  ADSR stages. The first is relative to the currentTime, and the others are relative
  to the previous value. The delay stage can be suppressed by passing an array of three 
  elements, in which case the envelope will be an ASR and the `s` value will be ignored.
  The release stage can be suppressed by passing an array of 2 elements, in which case the
  envelope will be an ADS envelope (useful if you're responding to user input or don't
  know the duration of the note.)
  - a: The final value of the parameter at the end of the attack stage. *Defaults to 1*
  - s: The value of the parameter at the end of the delay stage (or attack stage, 
  if delay is omitted), to be held until the beginning of the release stage. *Defaults to 1*


      adsr: (param, config) ->
        param = @[param] if typeof(param) is "string"
        _0 = @_instance.config.fake_zero
        { base, times, a, s } = config
        base ?= _0
        base = _0 if base is 0
        a ?= 1
        a = _0 if a is 0
        s ?= 1
        s = _0 if s is 0
        t = @context.currentTime
        times[0] ||= _0
        times[1] ||= _0
        times[2] ||= _0 if times.length > 2
        times[3] ||= _0 if times.length > 3
        config.ramp ?= @_instance.config.default_ramp_type
        #todo: allow ramp_type to be an array with different values for each stage
        switch config.ramp
          when 'linear' then ramp = param.linearRampToValueAtTime.bind param
          when 'expo' then ramp = param.exponentialRampToValueAtTime.bind param
        
        
        if(times.length is 2)
          #[a_time, d_time] = times
          param.cancelScheduledValues t
          param.setValueAtTime base , t
          ramp a, t + times[0]
          ramp s, t + times[0] + times[1]
        else if(times.length is 3)
          #[a_time, s_time, r_time] = times
          param.cancelScheduledValues t
          param.setValueAtTime base , t
          ramp a, t + times[0]
          param.setValueAtTime a, t + times[0] + times[1]
          ramp base , t + times[0] + times[1] + times[2]
        else
          #[a_time, d_time, s_time, r_time] = times
          param.cancelScheduledValues t
          param.setValueAtTime base , t
          ramp a, t + times[0]
          ramp s, t + times[0] + times[1]
          param.setValueAtTime s, t + times[0] + times[1] + times[2]
          ramp base , t + times[0] + times[1] + times[2] + times[3]
      
      

      



### MooogAudioNode.debug
Logs to the console if the debug config option is on
  
      debug: (a...) ->
        console.log(a...) if @_instance.config.debug
