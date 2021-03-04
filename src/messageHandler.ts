import * as amqp from "amqplib";
import jobsHandler from "./handlers/jobs";

export default function (channel: amqp.Channel) {
  return async (message: amqp.ConsumeMessage) => {
    const { fields, content, properties } = message;
    const { routingKey } = fields;

    let data: any, eventType: string;
    try {
      ({ data, eventType } = JSON.parse(content.toString()));
    } catch (e) {
      console.error("Invalid message format");
      channel.reject(message);
    }

    let consumed = false;

    try {
      switch (routingKey) {
        case "buzzle-jobs":
          consumed = await jobsHandler(data, eventType);
          break;
      }
      
      // successfully processed message
      consumed ? channel.ack(message) : channel.reject(message, false);
    } catch (e) {
      console.error(e);
    }
  };
}
