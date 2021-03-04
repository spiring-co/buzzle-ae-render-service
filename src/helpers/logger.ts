import * as fs from "fs";
import * as _ from "lodash";

export default function logger(socket, id, consoleLogPath) {
  let logs = [];
  let line = 1;
  fs.writeFileSync(consoleLogPath, "");
  return {
    log: (...data) => {
      console.log(...data);
      logs.push({ level: "info", data, line, timestamp: new Date().toLocaleString() });
      socket.emit("job-logs", { id, logs });
      fs.writeFileSync(consoleLogPath, JSON.stringify(logs));

      line += 1;
    },
    error: (...data) => {
      console.error(...data);
      logs.push({ level: "error", data, line });
      socket.emit("job-logs", { id, logs });
      fs.writeFileSync(consoleLogPath, JSON.stringify(logs));

      line += 1;
    },
  };
}
