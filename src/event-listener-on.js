module.exports = function(RED) {
    function EventListenerOn(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        this.eventId = n.eventId || null;
        this.eventListenerNamespace = RED.nodes.getNode(n.eventListenerNamespace);
        node.setMaxListeners(1000);

        node.log("Initializing event-listener-on node");

        if(!this.eventListenerNamespace) {
            node.warn("No namespace configuration node");
        }

        function getToValue(msg, type, property) {
            let value = property;
            if (type === "msg") {
                value = RED.util.getMessageProperty(msg, property);
            } else if ((type === 'flow') || (type === 'global')) {
                try {
                    value = RED.util.evaluateNodeProperty(property, type, node, msg);
                } catch(e2) {
                    throw new Error("Invalid value evaluation");
                }
            } else if(type === "bool") {
                value = (property === 'true');
            } else if(type === "num") {
                value = Number(property);
            }
            return value;
        }

        node.eventListenerNamespace.on(node.eventId, function(payload){
            if(typeof payload === "object" && !Array.isArray(payload)) {
                node.send(payload);
            } else {
                node.send({
                    topic: node.eventId,
                    payload: payload,
                });
            }
        })
    }

    RED.nodes.registerType("event-listener-on", EventListenerOn, {});
}