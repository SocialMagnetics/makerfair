"use strict";
var net = require('net');

var api = { };

api.create = function(host, port, lights)
{
    var luxxus = {};

    function getLightIdBytes(lightId)
    {
        let result = [];

        while (lightId.length) {
            let byte = lightId.substring(0,2); 
            result.unshift(parseInt(byte, 16));

            lightId = lightId.substring(2);
        }

        return result;
    }


    luxxus.host = host;
    luxxus.port = port;
    luxxus.accumulator = new Buffer(0);
    luxxus.commandsToSend = [];
    luxxus.messagesToSend = [];
    luxxus.inSend = false;
    luxxus.currentSettings = {};
    luxxus.receivedMessage = null;

    luxxus.groupPreamble = [ 0xf2, 0xc2, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x1d ];
    luxxus.groupHeader = [ 0x00, 0x00, 0x00, 0x59 ];

    luxxus.preamble = [
        0xf2, 0xc2, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x1d, 0x0c, 0x00, 0x00, 0x00, 0x59
    ];
    luxxus.allOffSetting = { red: 0x00, green: 0x00, blue: 0x00, luma: 0x00 };

    luxxus.currentSettings = lights; 

    luxxus.nextWorker = function(state)
    {
        // console.log('Processing ' + state);
        switch (state)
        {
            case 'processCommand':
                {
                    if (luxxus.commandsToSend.length == 0)
                        return;

                    var command = luxxus.commandsToSend[0];
                    command();
                }
                break;
            case 'disconnected':
                {
                    luxxus.socket.connect(luxxus.port, luxxus.host);
                }
                break;
            case 'connected':
                {
                    luxxus.next('sendMessage', 0);
                }
                break;
            case 'sendMessage':
                {
                    if (luxxus.messagesToSend.length == 0)
                    {
                        // will fire onClose event
                        luxxus.socket.end();
                        return;
                    }

                    // console.log('sending data');
                    // luxxus.next('awaitingResponse', 0);
                    var packet = luxxus.messagesToSend.shift();
                    luxxus.socket.write(packet, luxxus.onDataSent);
                }
                break;
            case 'awaitingResponse':
                {
                    // do nothing, the callback
                    // will change the state
                }
                break;
            case 'receivedMessage':
                {
                    luxxus.next('sendMessage', 0);
                }
            case 'error':
                {
                    var k = 9;
                }
                break;
        }
    }

    // luxxus controller needs time to think
    luxxus.next = function(state, delay)
    {
        // console.log('Transitioning to ' + state);

        setTimeout(
            function ()
            {
                luxxus.nextWorker(state)
            }
            , delay
        );
    }

    luxxus.pushCommand = function(command)
    {
        luxxus.commandsToSend.push(command);

        if (luxxus.commandsToSend.length == 1)
            luxxus.next('processCommand', 0);
    }

    luxxus.onConnect = function()
    {
        luxxus.next('connected', 5);
    }

    luxxus.onError = function(error)
    {
        console.log('Luxxus error: ' + error.toString());
        luxxus.next('error', 50);
    }

    luxxus.onClose = function(data)
    {
        if (luxxus.commandsToSend.length > 0)
            luxxus.commandsToSend.shift();

        luxxus.next('processCommand', 75);
    }

    luxxus.onData = function(data)
    {
        var accumulator = Buffer.concat([luxxus.accumulator, data]);
        luxxus.accumulator = accumulator;

        // console.log('received: ' + accumulator.length);

        var messageLength = 170;
        if (accumulator.length < messageLength)
            return;

        luxxus.receivedMessage = accumulator.slice(0, messageLength);

        var accumulatorSize = accumulator.length;
        var remainingBytes = accumulatorSize - messageLength;

        luxxus.accumulator = accumulator.slice(messageLength);

        luxxus.next('receivedMessage', 75);
    }

    luxxus.onDataSent = function(data)
    {
        luxxus.next('awaitingResponse', 0);
    }

    luxxus.makePacket = function(lightId, setting)
    {
        var bytes = [];

        let lightBytes = getLightIdBytes(lightId);

        bytes = bytes.concat(luxxus.preamble);
        bytes = bytes.concat(lightBytes);
        bytes.push(setting.luma);
        bytes.push(setting.red);
        bytes.push(setting.green);
        bytes.push(setting.blue);

        var packet = new Buffer(bytes);

        return packet;
    }

    luxxus.rampLight = function(lightId, toSetting)
    {
        luxxus.pushCommand(
            function()
            {
                var fromPacket = luxxus.makePacket(lightId, luxxus.currentSettings[lightId]);
                var toPacket = luxxus.makePacket(lightId, toSetting);

                luxxus.messagesToSend.push(fromPacket);
                luxxus.messagesToSend.push(toPacket);

                luxxus.currentSettings[lightId] = toSetting;

                luxxus.next('disconnected', 0);
            }
        );
    }

    luxxus.testPacket = function()
    {
        var lightIds = [
            [ 0x2a, 0xfa, 0xf1, 0x9c ],
            [ 0x89, 0xef, 0xf1, 0x9c ],
            [ 0xba, 0xf9, 0xf1, 0x9c ],
            [ 0xa3, 0xff, 0xf1, 0x9c ]
        ];

        luxxus.pushCommand(
            function()
            {
                var bytes = [
                    // 0xf2, 0xc2, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x1d, 0x0c, 0x00, 0x00, 0x00, 0x59

                    0xf2, 0xc2, 0xff, 0xff, 0xff, 0xff, 0x00, 0x00, 0x1d, /* 0x14 */ /* 0x1c */ 0x24, 0x00, 0x00, 0x00, 0x59,
                        0x2a, 0xfa, 0xf1, 0x9c, 0xff, 0xff, 0x00, 0x00,
                        0x89, 0xef, 0xf1, 0x9c, 0xff, 0x00, 0xff, 0x00,
                        0xba, 0xf9, 0xf1, 0x9c, 0xff, 0x00, 0x00, 0xff,
                        0xa3, 0xff, 0xf1, 0x9c, 0xff, 0xff, 0xff, 0x00,
                        ];
                var packet = new Buffer(bytes);

                luxxus.messagesToSend.push(packet);

                luxxus.next('disconnected', 0);
            }
        );
    }

    luxxus.setLights = function(lightSettings, optimize)
    {
        if ((typeof optimize === 'undefined') || optimize == null)
            optimize = true;

        if (lightSettings == null)
            return;

        var lightIds = Object.keys(lightSettings);
        var toSet = {};
        var setCount = 0;
        var setIds = [];
        var states = [];
        var setStates = [];

        lightIds.forEach(
            function (lightId) {
                if (lightId == null)
                    return;

                if (!lightSettings.hasOwnProperty(lightId))
                    return;

                var setting = lightSettings[lightId];

                if (setting == null)
                    return;

                var currentSetting = luxxus.currentSettings[lightId];
                if (currentSetting == null)
                    return;

                if ((typeof setting.red === 'undefined') || setting.red == null)
                    setting.red = currentSetting.red;

                if ((typeof setting.green === 'undefined') || setting.green == null)
                    setting.green = currentSetting.green;

                if ((typeof setting.blue === 'undefined') || setting.blue == null)
                    setting.blue = currentSetting.blue;

                if ((typeof setting.luma === 'undefined') || setting.luma == null)
                    setting.luma = 255;

                if (!optimize ||
                    setting.red != currentSetting.red ||
                    setting.green != currentSetting.green ||
                    setting.blue != currentSetting.blue ||
                    setting.luma != currentSetting.luma)
                {
                    toSet[lightId] = setting;
                    setCount++;
                    setIds.push(lightId);

                    states.push([setting.luma, setting.red, setting.green, setting.blue]);
                    setStates.push(setting);
                }
            }
        );

        if (setCount == 0)
            return;

        var bytes = [];
        
        bytes = bytes.concat(luxxus.groupPreamble);
        bytes.push(4 + (setCount * 8));
        bytes = bytes.concat(luxxus.groupHeader);

        for (var i = 0; i < setCount; i++)
        {
            var lightId = setIds[i];

            let lightIdBytes = getLightIdBytes(lightId);

            bytes = bytes.concat(lightIdBytes);
            bytes = bytes.concat(states[i]);
        }

        var packet = new Buffer(bytes);

        luxxus.pushCommand(
            function()
            {
                luxxus.messagesToSend.push(packet);

                for (var i = 0; i < setCount; i++)
                {
                    var lightId = setIds[i];
                    luxxus.currentSettings[lightId] = setStates[i];
                }

                luxxus.next('disconnected', 0);
            }
        );

    }

    luxxus.socket = new net.Socket();
    luxxus.socket.on('connect', luxxus.onConnect);
    luxxus.socket.on('error', luxxus.onError);
    luxxus.socket.on('data', luxxus.onData);
    luxxus.socket.on('close', luxxus.onClose);

    return luxxus;
}

module.exports = api;
