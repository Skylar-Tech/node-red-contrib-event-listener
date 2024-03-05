module.exports = function(RED) {
    function EventListenerEmit(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        this.eventIdType = n.eventIdType || null;
        this.eventIdValue = n.eventIdValue || null;
        this.sendType = n.sendType || "msg";
        this.payloadType = n.payloadType || null;
        this.payloadValue = n.payloadValue || null;
        this.returns = n.returns || null;
        this.eventListenerNamespace = RED.nodes.getNode(n.eventListenerNamespace);
        node.setMaxListeners(1000);

        node.log("Initializing event-listener-emit node");

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

        node.on("input", async function(msg) {
            let eventId = getToValue(msg, node.eventIdType, node.eventIdValue);
            let eventPayload = node.sendType === "property" ? getToValue(msg, node.payloadType, node.payloadValue) : msg;

            node.eventListenerNamespace.emit(eventId, eventPayload);
            node.send(msg);
        });
    }

    RED.nodes.registerType("event-listener-emit", EventListenerEmit, {});
}