const mqtt  = require('mqtt');
const RSVP  = require('rsvp');

const { Promise } = RSVP;

export default class NOMClient {
  constructor(host, options) {
    this.host = host;

    this.logLevel = (options && options.logLevel) || 1;
    this.maxConcurrentConnections = (options && options.maxConcurrentConnections) || 1000;
    this.thenPrefix = (options && options.thenPrefix) || '_then';
    this.catchPrefix = (options && options.catchPrefix) || '_catch';
  }

  connect() {
    let client = MQTT.connect(this.host);
    this.rootResponseTopic = `demo/response/${client.options.clientId}`;
    this.client = client;
    this._responseTopics = {};

    client.on('message', this._onMessage.bind(this));

    return new Promise((resolve) => {
      client.on('connect', (connack) => {
        if (!connack.sessionPresent) {
          resolve();
        }
      });
    });
  }

  disconnect() {
    this.client.end();
  }

  subscribe(filter, callback) {
    this._log(2, `Subscribing to messages on ${filter}/#.`);
    this.onChangeCallback = callback;
    this.client.subscribe(filter, {
      qos: 0
    });
  }

  subscribeAll(topic, callback) {
    this._log(2, `Subscribing to all messages on ${topic}/#.`);
    this.onChangeCallback = callback;
    this.client.subscribe(`${topic}/#`, {
      qos: 0
    });
  }

  invoke(topic, method, params) {
    let { client } = this;
    let { msgId, resolveTopic, rejectTopic } = this._getAvailableResponseTopics(method);

    let msgContent = {
      method,
      then: resolveTopic,
      catch: rejectTopic,
      params
    };

    client.subscribe([ resolveTopic, rejectTopic ]);

    return new Promise((resolve, reject) => {
      this._responseTopics[msgId] = {
        resolve: (response) => {
          resolve(response);
        },
        reject: ({ error }) => {
          reject(new Error(`${error.message} (${error.code})`));
        }
      };

      this._log(3, `Calling \`${method}\` on \`${topic}\` (${msgId})`, params);
      client.publish(topic, JSON.stringify(msgContent));
    }, `id: ${msgId}, method: ${method}`).finally(() => {
      this._responseTopics[msgId] = undefined;
    });
  }

  _getAvailableResponseTopics(method) {
    let connectionCount = Object.keys(this._responseTopics).length;

    if (connectionCount >= this.maxConcurrentConnections) {
      throw new Error('Maximum connection count exceeded');
    }

    let msgId = Math.floor(Math.random() * (this.maxConcurrentConnections));

    while (this._responseTopics[msgId]) {
      msgId = Math.floor(Math.random() * (this.maxConcurrentConnections));
    }

    return {
      msgId,
      resolveTopic: `${this.rootResponseTopic}/${method}/${this.thenPrefix}${msgId}`,
      rejectTopic: `${this.rootResponseTopic}/${method}/${this.catchPrefix}${msgId}`
    };
  }

  _getResponseMethod(topic) {
    let exp = `(${this.thenPrefix}|${this.catchPrefix})(\\d+)`;
    let match = topic.match(exp);

    if (match) {
      let [ , type , id ] = match;
      return type === this.thenPrefix ? this._responseTopics[id].resolve : this._responseTopics[id].reject;
    } else {
      return null;
    }
  }

  _onMessage(topic, message) {
    let responseMethod = this._getResponseMethod(topic);

    let reader = new FileReader();

    reader.addEventListener('loadend', function() {
      let response = JSON.parse(reader.result);

      if (responseMethod) {
        this._log(3, `\`${topic}\`:`, response);
        responseMethod(response);
      } else if (response.event) {
        this._log(2, `Event on ${topic}`, response);

        if (!this.responseCallback) {
          this.onChangeCallback(topic, response);
        }
      } else {
        this._log(1, `Message with unknown handler on '${topic}': `, response);
      }
    }.bind(this));

    reader.readAsText(new Blob([ message ]));
  }

  _log(level, ...params) {
    if (level <= this.logLevel) {
      console.debug('[NOMClient]', ...params);
    }
  }
}
