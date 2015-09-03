## Delay

Wraps the DelayNode AudioContext object

    class Delay extends MooogAudioNode
      constructor: (@_instance, config = {}) ->
        config.node_type = 'Delay'
        super
        @configure_from config
        @insert_node @context.createDelay(), 0
        
        @_feedback_stage = new Gain( @_instance, { connect_to_destination: false, gain: 0.99 } )
        @_nodes[0].connect @to @_feedback_stage
        @_feedback_stage.connect @to @_nodes[0]
        @feedback = @_feedback_stage.gain
        
        @zero_node_setup config
      