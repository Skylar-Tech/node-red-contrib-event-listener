module.exports = function(RED) {
    function EventListenerNamespace(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        node.setMaxListeners(1000);

        node.log("Initializing event-listener-namespace node");
    }

    RED.nodes.registerType("event-listener-namespace", EventListenerNamespace, {});
}