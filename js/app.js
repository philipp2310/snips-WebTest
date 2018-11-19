/**
 * Copyright 2013 dc-square GmbH
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author: Christoph Schäbel
 */
function wakeWord(){
	websocketclient.publish('hermes/hotword/'+$( "#wakeword").val()+'/detected'
			,'{"siteId":"'+$( "#siteId").val()+'","modelId":"hey_snips","modelVersion":"hey_snips_3.1_2018-04-13T15:27:35_model_0019","modelType":"universal","currentSensitivity":0.5}'
			,0,false);
}
function pretendInput(){
	websocketclient.publish('hermes/asr/textCaptured'
			,'{"text":"'+$( '#publishPayload' ).val()+'","likelihood":0.50297457,"tokens":[{"value":"'+$( '#publishPayload' ).val()+'","confidence":1,"range_start":0,"range_end":8,"time":{"start":0.08803082,"end":1.6948999}}],"seconds":2.0,"siteId":"'+$( '#siteId').val()+'","sessionId":"'+$( '#sessionId' ).val()+'"}'
			,0,false)
}
function testIntent(){
	websocketclient.publish('hermes/nlu/query'
			,'{"input":"'+$( '#publishPayload' ).val()+'","asrTokens":[{"value":"'+$( '#publishPayload' ).val()+'","confidence":1,"range_start":0,"range_end":8,"time":{"start":0.08803082,"end":1.6948999}}],"intentFilter":null,"id":"dontmatter","sessionId":"'+$( '#sessionId' ).val()+'"}'
			,0,false)
}
function testTTS(){
	websocketclient.publish('hermes/tts/say'
			,'{"text":"'+$( '#publishPayload' ).val()+'","lang":"'+$( "#ttsLang").val()+'","id":"none","siteId":"'+$( "#siteId").val()+'","sessionId":"none"}'
			,0,false)
}
function toggleReadme(){
	if($('#readmeMain').css('display') == 'none'){
		websocketclient.render.show('readme');
		websocketclient.render.hide('content');
		websocketclient.render.hide('connection');
	} else {
		websocketclient.render.hide('readme');
		websocketclient.render.show('content');
		websocketclient.render.hide('connection');
	}
}

function toggleConnection(){ 
	if($('#connectionMain').css('display') == 'none'){
		websocketclient.render.show('connection');
		websocketclient.render.hide('content');
		websocketclient.render.hide('readme');
	} else {
		websocketclient.render.hide('connection');
		websocketclient.render.show('content');
		websocketclient.render.hide('readme');
	}
}
var websocketclient = {
    'client': null,
    'lastMessageId': 1,
    'lastSubId': 1,
    'subscriptions': [],
    'messages': [],
    'connected': false,

    'connect': function () {

        var host = $('#urlInput').val();
        var port = parseInt($('#portInput').val(), 10);
        var clientId = $('#clientIdInput').val();
        var username = $('#userInput').val();
        var password = $('#pwInput').val();
        var keepAlive = parseInt($('#keepAliveInput').val());
        var cleanSession = true;
        var lwTopic = $('#lwTopicInput').val();
        var lwQos = parseInt($('#lwQosInput').val());
        var lwRetain = $('#LWRInput').is(':checked');
        var lwMessage = $('#LWMInput').val();
        var ssl = $('#sslInput').is(':checked');

        this.client = new Messaging.Client(host, port, clientId);
        this.client.onConnectionLost = this.onConnectionLost;
        this.client.onMessageArrived = this.onMessageArrived;

        var options = {
            timeout: 3,
            keepAliveInterval: keepAlive,
            cleanSession: cleanSession,
            useSSL: ssl,
            onSuccess: this.onConnect,
            onFailure: this.onFail
        };

        if (username.length > 0) {
            options.userName = username;
        }
        if (password.length > 0) {
            options.password = password;
        }

        this.client.connect(options);
    },

    'onConnect': function () {
        websocketclient.connected = true;
        var body = $('body').addClass('connected').removeClass('notconnected').removeClass('connectionbroke');

        websocketclient.render.hide('connection');
        websocketclient.render.show('content');
		subPre();
    },

    'onFail': function (message) {
        websocketclient.connected = false;
        console.log("error: " + message.errorMessage);
        websocketclient.render.showError('Connect failed: ' + message.errorMessage);
    },

    'onConnectionLost': function (responseObject) {
        websocketclient.connected = false;
        if (responseObject.errorCode !== 0) {
            console.log("onConnectionLost:" + responseObject.errorMessage);
        }
        $('body.connected').removeClass('connected').addClass('notconnected').addClass('connectionbroke');
        websocketclient.render.show('connection');
        websocketclient.render.hide('content');

        //Cleanup messages
        websocketclient.messages = [];
        websocketclient.render.clearMessages();

        //Cleanup subscriptions
        websocketclient.subscriptions = [];
        websocketclient.render.clearSubscriptions();
    },

    'onMessageArrived': function (message) {
    	if(message.destinationName.includes("audioFrame")){
        	return;
    	}
    	
    	var subscription = websocketclient.getSubscriptionForTopic(message.destinationName);
        
        if( message.destinationName.includes("hermes/audioServer/"+$('#siteId').val()+"/playBytes")){
        	websocketclient.publish('hermes/audioServer/'+$('#siteId').val()+'/playFinished'
					,'{"id":"'+message.destinationName.split('/')[4]+'","siteId":"'+$('#siteId').val()+'","sessionId":"'+$('#sessionId').val()+'"}'
					,0,false)
        	return;
        }
        
        var messageObj = {
            'topic': message.destinationName,
            'retained': message.retained,
            'qos': message.qos,
            'payload': message.payloadString,
            'timestamp': moment(),
            'subscriptionId': subscription.id,
            'color': websocketclient.getColorForSubscription(subscription.id)
        };
        
        if(messageObj.topic == "hermes/dialogueManager/sessionStarted"){
    		var pay = JSON.parse(messageObj.payload)
    		if(pay['siteId'] == $('#siteId').val()){
    			$('#sessionId').val(pay['sessionId']);
        		websocketclient.render.hideInst('wakeBut');
        		websocketclient.render.showInst('speakBut');
    		}
        } else if(messageObj.topic == "hermes/dialogueManager/sessionEnded"){
    		var pay = JSON.parse(messageObj.payload)
    		if(pay['siteId'] == $('#siteId').val()){
    			$('#sessionId').val("");
        		websocketclient.render.showInst('wakeBut');
        		websocketclient.render.hideInst('speakBut');
    		}
        } else if(messageObj.topic == "hermes/tts/say"){
        	var pay = JSON.parse(messageObj.payload)
    		if(pay['sessionId'] == $('#sessionId').val()){
    			$('#lastTTS').html(pay['text']);
    		}
        }
        
        messageObj.id = websocketclient.render.message(messageObj);
        websocketclient.messages.push(messageObj);
    },

    'disconnect': function () {
        this.client.disconnect();
    },

    'publish': function (topic, payload, qos, retain) {

        if (!websocketclient.connected) {
            websocketclient.render.showError("Not connected");
            return false;
        }

        var message = new Messaging.Message(payload);
        message.destinationName = topic;
        message.qos = qos;
        message.retained = retain;
        this.client.send(message);
    },

    'subscribe': function (topic, qosNr, color) {

        if (!websocketclient.connected) {
            websocketclient.render.showError("Not connected");
            return false;
        }

        if (topic.length < 1) {
            websocketclient.render.showError("Topic cannot be empty");
            return false;
        }

        if (_.find(this.subscriptions, { 'topic': topic })) {
            websocketclient.render.showError('You are already subscribed to this topic');
            return false;
        }

        this.client.subscribe(topic, {qos: qosNr});
        if (color.length < 1) {
            color = '999999';
        }

        var subscription = {'topic': topic, 'qos': qosNr, 'color': color};
        subscription.id = websocketclient.render.subscription(subscription);
        this.subscriptions.push(subscription);
        return true;
    },

    'unsubscribe': function (id) {
        var subs = _.find(websocketclient.subscriptions, {'id': id});
        this.client.unsubscribe(subs.topic);
        websocketclient.subscriptions = _.filter(websocketclient.subscriptions, function (item) {
            return item.id != id;
        });

        websocketclient.render.removeSubscriptionsMessages(id);
    },

    'deleteSubscription': function (id) {
        var elem = $("#sub" + id);

        if (confirm('Are you sure ?')) {
            elem.remove();
            this.unsubscribe(id);
        }
    },

    'getRandomColor': function () {
        var r = (Math.round(Math.random() * 255)).toString(16);
        var g = (Math.round(Math.random() * 255)).toString(16);
        var b = (Math.round(Math.random() * 255)).toString(16);
        return r + g + b;
    },

    'getSubscriptionForTopic': function (topic) {
        var i;
        for (i = 0; i < this.subscriptions.length; i++) {
            if (this.compareTopics(topic, this.subscriptions[i].topic)) {
                return this.subscriptions[i];
            }
        }
        return false;
    },

    'getColorForPublishTopic': function (topic) {
        var id = this.getSubscriptionForTopic(topic);
        return this.getColorForSubscription(id);
    },

    'getColorForSubscription': function (id) {
        try {
            if (!id) {
                return '99999';
            }

            var sub = _.find(this.subscriptions, { 'id': id });
            if (!sub) {
                return '999999';
            } else {
                return sub.color;
            }
        } catch (e) {
            return '999999';
        }
    },

    'compareTopics': function (topic, subTopic) {
        var pattern = subTopic.replace("+", "(.+?)").replace("#", "(.*)");
        var regex = new RegExp("^" + pattern + "$");
        return regex.test(topic);
    },

    'render': {

        'showError': function (message) {
            alert(message);
        },
        'messages': function () {

            websocketclient.render.clearMessages();
            _.forEach(websocketclient.messages, function (message) {
                message.id = websocketclient.render.message(message);
            });
            
        },
        'message': function (message) {
        	var largest = websocketclient.lastMessageId++;

            var html = '<li class="messLine" id="' + largest + '">' +
                '   <div class="row mess' + largest + '" style="border-left: solid 10px #' + message.color + '; ">' +
                '       <div class="columns messageText">' +
                '           <div class="columns date">' + message.timestamp.format("YYYY-MM-DD HH:mm:ss") + '</div>' +
                '           <div class="columns topicM truncate" id="topicM' + largest + '" title="' + Encoder.htmlEncode(message.topic, 0) + '">Topic: ' + Encoder.htmlEncode(message.topic) + '</div>' +
                '           <div class="columns retain">';
            if (message.retained) {
                html += 'Retained';
            }
            html += '           </div>' +
                '           <div class="columns message break-words">' + Encoder.htmlEncode(message.payload) + '</div>' +
                '       </div>' +
                '   </div>' +
                '</li>';
            $("#messEdit").prepend(html);
            return largest;
        },

        'subscriptions': function () {
            websocketclient.render.clearSubscriptions();
            _.forEach(websocketclient.subscriptions, function (subs) {
                subs.id = websocketclient.render.subscription(subs);
            });
        },

        'subscription': function (subscription) {
            var largest = websocketclient.lastSubId++;
            
            return largest;
        },

        'toggleAll': function () {
            websocketclient.render.toggle('connection');
            websocketclient.render.toggle('content');
        },

        'toggle': function (name) {
            var elem = $('#' + name + 'Main');
            elem.slideToggle();
        },

        'hide': function (name) {
            var elem = $('#' + name + 'Main');
            elem.slideUp();
        },
        'hideInst': function (name) {
            var elem = $('#' + name + 'Main');
            elem.hide();
        },

        'show': function (name) {
            var elem = $('#' + name + 'Main');
            elem.slideDown();
        },

        'showInst': function (name) {
            var elem = $('#' + name + 'Main');
            elem.show();
        },

        'removeSubscriptionsMessages': function (id) {
            websocketclient.messages = _.filter(websocketclient.messages, function (item) {
                return item.subscriptionId != id;
            });
            websocketclient.render.messages();
        },

        'clearMessages': function () {
            $("#messEdit").empty();
        },

        'clearSubscriptions': function () {
            $("#innerEdit").empty();
        }
    }
};
