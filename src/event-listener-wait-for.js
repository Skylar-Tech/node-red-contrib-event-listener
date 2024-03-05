const nanoid = require('nanoid');

class TimeoutManager {
    constructor() {
        this.timeouts = new Map();
    }

    // Adds a new timeout and returns its unique ID
    setTimeout(callback, delay) {
        const id = nanoid();
        const timeout = setTimeout(() => {
            callback();
            this.timeouts.delete(id); // Automatically delete the timeout once it completes
        }, delay);
        this.timeouts.set(id, timeout);
        return id;
    }

    // Clears a specific timeout using its unique ID
    clearTimeout(id) {
        const timeout = this.timeouts.get(id);
        if (timeout) {
            clearTimeout(timeout);
            this.timeouts.delete(id);
        }
    }

    // Clears all timeouts
    clearAllTimeouts() {
        for (const [id, timeout] of this.timeouts) {
            clearTimeout(timeout);
            this.timeouts.delete(id);
        }
    }
}

module.exports = function(RED) {
    function EventListenerWaitFor(n) {
        RED.nodes.createNode(this, n);
        let node = this;
        this.timeoutManager = new TimeoutManager();
        this.eventIdType = n.eventIdType || null;
        this.eventIdValue = n.eventIdValue || null;
        // this.multipleEvents = n.multipleEvents || "allowed"; // @TODO finish getting multipleEvents option to work
        this.timeoutHandling = n.timeoutHandling || "single";
        this.timeoutType = n.timeoutType || null;
        this.timeoutValue = n.timeoutValue || "60000";
        this.timeoutUnit = n.timeoutUnit || "ms";
        this.eventHandling = n.eventHandling || "set-property";
        this.eventHandlingPropType = n.eventHandlingPropType || "msg";
        this.eventHandlingPropValue = n.eventHandlingPropValue || "payload";
        this.eventListenerNamespace = RED.nodes.getNode(n.eventListenerNamespace);
        node.setMaxListeners(1000);

        node.log("Initializing event-listener-wait-for node");

        if(!this.eventListenerNamespace) {
            node.warn("No namespace configuration node");
            node.status({fill:"red",shape:"dot",text:"No namespace configuration node"});
        }
        node.status({fill:"green",shape:"dot",text:`ready`});

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

        function setToValue(msg, type, property, valueToSet) {
            if (type === "msg") {
                // Set the property on the msg object
                RED.util.setMessageProperty(msg, property, valueToSet, true);
            } else if (type === 'flow' || type === 'global') {
                // Set the property on the flow or global context
                const context = node.context();
                if (type === 'flow') {
                    context.flow.set(property, valueToSet);
                } else if (type === 'global') {
                    context.global.set(property, valueToSet);
                }
            }
            return msg;
        }

        node.on("input", async function(msg) {
            let eventId = getToValue(msg, node.eventIdType, node.eventIdValue),
                timeout = getToValue(msg, node.timeoutType, node.timeoutValue) || false,
                timeoutId = null;

            if(isNaN(timeout)) {
                node.status({fill:"red", shape:"ring", text:"Timeout is not a number"});
                return null;
            } else if(timeout <= 0) {
                node.status({fill:"orange", shape:"ring", text:"Timeout cannot be <= 0"});
                return null;
            }

            console.log("timeout1", timeout, node.timeoutUnit);

            switch (node.timeoutUnit) {
                case "s":
                    timeout = timeout * 1000;
                    break;
                case "m":
                    timeout = timeout * 1000 * 60;
                    break;
                case "h":
                    timeout = timeout * 1000 * 60 * 60;
                    break;
                case "d":
                    timeout = timeout * 1000 * 60 * 60 * 24;
                    break;
            }
            console.log("timeout2", timeout);

            timeoutId = node.timeoutManager.setTimeout(function(){
                removeListener();
                node.send([null, msg]);
                node.status({fill:"red",shape:"dot",text:`timeout: ${eventId}`});
            }, timeout);

            function callback(payload){
                let newMsg = undefined;
                if(node.eventHandling === "merge-original" && typeof payload === "object") {
                    // merge event payload into msg
                    newMsg = Object.assign({}, msg, payload);
                } else if(node.eventHandling === "merge-event" && typeof payload === "object") {
                    // merge msg into event payload
                    newMsg = Object.assign({}, payload, msg);
                } else if(node.eventHandling === "set-property") {
                    // set the event payload to a specific property
                    newMsg = setToValue(msg, node.eventHandlingPropType, node.eventHandlingPropValue, payload);
                }
                if(node.timeoutHandling === "single") {
                    // we only want a single event, so remove the listener
                    removeListener();
                    if(timeoutId) {
                        node.timeoutManager.clearTimeout(timeoutId);
                    }
                }
                node.send(newMsg || msg);
                node.status({fill:"green",shape:"dot",text:`completed: ${eventId}`});
            }

            function removeListener() {
                node.eventListenerNamespace.removeListener(eventId, callback);
            }
            node.eventListenerNamespace.on(eventId, callback);
            node.status({fill:"orange", shape:"ring", text:`waiting: ${eventId}`});
        });

        node.on("close", function() {
            // clear any timeouts
            if(node.timeoutManager) {
                node.timeoutManager.clearAllTimeouts();
            }
        });
    }

    RED.nodes.registerType("event-listener-wait-for", EventListenerWaitFor, {});
}