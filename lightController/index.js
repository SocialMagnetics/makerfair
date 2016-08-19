'use strict';

var mqtt    = require('mqtt');
var client  = mqtt.connect('mqtt://ams1.socialmagnetics.com');

const luxxusFactory = require('./luxxus');
var luxxusHost = '192.168.1.89';
var luxxusPort = 41330;
let lightObject = {};

const lightIds = ["9BE0FA9D","9BE0F985","9BE0EEE4","9BE0F0EC","9BE0FF99","9BE0FA6F"];
let lights = {};

lightIds.forEach((lightId) => {
    lights[lightId] = {
        red: 255,
        green: 255,
        blue: 255,
        luma: 255,
    };
});

let luxxus = luxxusFactory.create(luxxusHost, luxxusPort, lights);

client.on('connect', function () {
  client.subscribe('SYS/AHC/Events/Home/#');
});

function handleEverything(state) {
    Object.keys(lights).forEach((key) => {
        let light = lights[key];
        light.luma = state ? 255 : 0;
    });

    luxxus.setLights(lights, false);
}

function handleRed(state) {
    if (state) {
        Object.keys(lights).forEach((key) => {
            let light = lights[key];
            light.red = 255;
            light.green = 0;
            light.blue = 0;
            light.luma = 255;
        });
    } else {
        Object.keys(lights).forEach((key) => {
            let light = lights[key];
            light.red = 255;
            light.green = 255;
            light.blue = 255;
        });
    }

    luxxus.setLights(lights, false);
}

function handleGreen(state) {
    if (state) {
        Object.keys(lights).forEach((key) => {
            let light = lights[key];
            light.red = 0;
            light.green = 255;
            light.blue = 0;
            light.luma = 255;
        });
    } else {
        Object.keys(lights).forEach((key) => {
            let light = lights[key];
            light.red = 255;
            light.green = 255;
            light.blue = 255;
        });
    }

    luxxus.setLights(lights, false);
}

function handleBlue(state) {
    if (state) {
        Object.keys(lights).forEach((key) => {
            let light = lights[key];
            light.red = 0;
            light.green = 0;
            light.blue = 255;
            light.luma = 255;
        });
    } else {
        Object.keys(lights).forEach((key) => {
            let light = lights[key];
            light.red = 255;
            light.green = 255;
            light.blue = 255;
        });
    }

    luxxus.setLights(lights, false);
}

function handleWhite(state) {
    if (state) {
        Object.keys(lights).forEach((key) => {
            let light = lights[key];
            light.red = 255;
            light.green = 255;
            light.blue = 255;
            light.luma = 255;
        });
    } else {
        Object.keys(lights).forEach((key) => {
            let light = lights[key];
            light.red = 255;
            light.green = 255;
            light.blue = 255;
            light.luma = 0;
        });
    }

    luxxus.setLights(lights, false);
}

/* accepts parameters
 * h  Object = {h:x, s:y, v:z}
 * OR 
 * h, s, v
*/
function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (h && s === undefined && v === undefined) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.floor(r * 255),
        g: Math.floor(g * 255),
        b: Math.floor(b * 255)
    };
}

function getSetting()
{
    var r = Math.floor((Math.random() * 255));
    var g = Math.floor((Math.random() * 255));
    var b = Math.floor((Math.random() * 255));
    var l = Math.floor((Math.random() * 255));
    l = 255;

    var settings = { red: r, green: g, blue: b, luma: l };

    return settings;
}

function handleRandom(state) {
    if (state) {
        Object.keys(lights).forEach((key) => {
            lights[key] = getSetting();
            lights[key].luma = 255;
        });
    } else {
        Object.keys(lights).forEach((key) => {
            let light = lights[key];
            light.red = 255;
            light.green = 255;
            light.blue = 255;
            light.luma = 0;
        });
    }

    luxxus.setLights(lights, false);
}

let timerId = -1;

function handleTheParty(state) {
    if (state) {
        if (timerId >= 0)
            return;
        
        timerId = setInterval(() => {
            handleRandom(true);
        }, 300);
    } else {
        clearInterval(timerId);
        timerId = -1;
        handleWhite(true);
    }
}

function handleUtility(item, state) {
    switch (item) {
        case 'Everything':
            handleEverything(state);
            break;
        case 'Red':
            handleRed(state);
            break;
        case 'Green':
            handleGreen(state);
            break;
        case 'Blue':
            handleBlue(state);
            break;
        case 'White':
            handleWhite(state);
            break;
        case 'Random':
            handleRandom(state);
            break;
        case 'The Party':
            handleTheParty(state);
            break;
    }
}

function handleLight(lightId, state) {
    lights[lightId].luma = state ? 255 : 0;
    luxxus.setLights(lights, false);
}

client.on('message', function (topic, buffer) {
    let message = JSON.parse(buffer.toString());

    if (!message.property.endsWith('PowerState'))
        return;

    let state = message.value;
    
    if (topic.indexOf('/Utilities/') >= 0) {
        let utility = topic.substring('SYS/AHC/Events/Home/Utilities/'.length);
        handleUtility(utility, state);
    }
    else {
        let lightId = topic.substring('SYS/AHC/Events/Home/'.length);
        let lightIndex = lightIds.indexOf(lightId);

        if (lightIndex < 0)
            return;

        handleLight(lightId, state);
    }


/*
    this.lightObject.getObjects(lightIds).then((lightObjects) => {
    let lights = {};
    lightObjects.map((light) => {
        let powerState = light.powerState || false;

        if (powerState) {
            lights[light.luxxusId] = {
                red: light.red || 0,
                green: light.green || 0,
                blue: light.blue || 0,
                luma: light.luma || 0,
            };
        } else {
            lights[light.luxxusId] = {
                red: 0,
                green: 0,
                blue: 0,
                luma: 0,
            };
        }
    });

    let keys = Object.keys(lights);
    // console.log('Result = ' + JSON.stringify(keys));

    this.luxxus.setLights(lights, false);
*/
});

/*

const process = require('process');
const joinPath = require('path').posix.join;

const remoteRequire = require('../../')({ timeout: 2000, logger: console });
var argv = require('yargs')
    .option( "h", { alias: "hive", demand: false, describe: "Hive Name", default: "sm-luxxus", type: "string" } )
    .option( "s", { alias: "serviceTopic", demand: false, describe: "Service Topic", default: "sm-luxxus", type: "string" } )
    .option( "w", { alias: "worldTopic", demand: false, describe: "World Topic", default: "world", type: "string" } )
    .argv;

let hive = require('../sm-hive');
const hiveName = argv.hive;
const serviceName = argv.serviceTopic;
const worldTopic = argv.worldTopic;
const worldSubscription = '^/SYS/AHC/Home/#';


const service = {
    // Manifest is required
    manifest: {
        // MQTT topic path suffix that defines the "name" of the service
        name:        serviceName,
        description: 'Luxxus Lighting Controller',
        version:     '1.0.0'
    },

    state: {},
    luxxus: {},
    lightObject: {},

    main(transport) {
        transport.subscribe(worldSubscription).then(() => {
            remoteRequire('SYS/AHC/Home').then((lightObject) => {
                this.lightObject = lightObject;
                return lightObject.getObjects(lightIds);
            }).then((lightObjects) => {
                let lights = {};
                lightObjects.map((light) => {
                    let powerState = light.powerState || false;

                    if (powerState) {
                        lights[light.luxxusId] = {
                            red: light.red || 0,
                            green: light.green || 0,
                            blue: light.blue || 0,
                            luma: light.luma || 0,
                        };
                    } else {
                        lights[light.luxxusId] = {
                            red: 0,
                            green: 0,
                            blue: 0,
                            luma: 0,
                        };
                    }
                });

                let keys = Object.keys(lights);
                // console.log('Result = ' + JSON.stringify(keys));

                this.luxxus = luxxusFactory.create(luxxusHost, luxxusPort, lights);
                // console.log('Result = ' + JSON.stringify(lights));
                this.luxxus.setLights(lights, false);
            });
        });
    },

    onMessage(topic, message) {
        });
    }
};

console.log('Loading Hive: ' + hiveName);

hive.open(hiveName).then((state) => {
    service.state = state;

    console.log('Hive Loaded');
}).then(() => {
    return hive.close(hiveName, service.state);
}).then(() => {
    console.log('Starting Service');
    const startService = require('../../').service({ logger: console });
    return startService(service);
}).then((service) => {
    console.log('Service Running on Topic: ' + serviceName);
    return service.stopPromise;
}).then(() => {
    console.log('Service stopped')  ;
//    return hive.close(hiveName, service.state);
}).catch(err => {
    console.log('Service error: ' + err.toString());
//    return hive.close(hiveName, service.state);
}).then(() => {
    process.exit();
});

process.on('SIGINT', () => {
    console.log('Shutting down');
    service.stopService();
});
*/
