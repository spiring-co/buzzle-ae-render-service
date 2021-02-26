import * as fs from "fs";
import * as path from "path";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
import { io } from "socket.io-client";
import { render } from "@nexrender/core";
import { ChildProcess } from "child_process";
import toNexrenderJob from "../helpers/toNexrenderJob";
import * as _ from "lodash";

dotenv.config();
const { API_URL, SOCKET_SERVER, API_TOKEN } = process.env;

const socket = io(SOCKET_SERVER);

let currentJob: string = null;
let runningInstance: ChildProcess = null;

const settings: any = {
  stopOnError: true,
  workpath: path.join(process.cwd(), "renders"),
  skipCleanup: true,
  addLicense: false,
  debug: true,
  onInstanceSpawn: (instance, job, settings) => {
    runningInstance = instance;
    currentJob = job.uid;
  },
};

const socketLogger = (id) => {
  let logs = "";
  return {
    log: (data) => {
      console.log(data)
      logs += `${data} \n`;
      socket.emit("job-logs", id, logs)
    }
  }
}

// returns true if consumed message successfully
export default async function (data: any, eventType: string): Promise<boolean> {
  // console.log(eventType, _.pick(data, ["updates", "extra"], data.job.id))
  let { job, updates = false, extra = false } = data;

  switch (eventType) {

    case "created":
      return await renderJob(job)

    case "updated":
      console.log(updates, extra)
      if (extra?.forceRerender) {
        socketLogger(job.id).log("Rerendering as forced rerender flag")
        return await renderJob(job)
      }

      if (_.has(updates, "data")) {
        socketLogger(job.id).log("Rerendering as data has changed")
        return await renderJob(job)
      }

      if (_.has(updates, "actions")) {
        console.log("Rerendering as actions has changed")
        return await renderJob(job)
      }

      if (_.has(updates, "renderPrefs")) {
        console.log("Rerendering as renderPrefs has changed")
        return await renderJob(job)
      }

      break;

    case "deleted":
      break;
  }

  return true;
}

const updateJob = async (uid, body) => {
  const res = await fetch(`${API_URL}/jobs/${uid}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization:
        `Bearer ${API_TOKEN}`,
    },
  });
  const result = await res.json();
  console.log(result)
};


const renderJob = async (job) => {
  try {
    // convert to nexrender job
    job = toNexrenderJob(job);
    settings.logger = socketLogger(job.uid)
    // update status to started on API
    await updateJob(job.uid, {
      state: "started",
      dateStarted: new Date().toISOString(),
    });
    socket.emit("job-progress", job, {
      state: "started",
    });

    // TODO add socket implementation
    job.onRenderProgress = (job, progress) => {
      socket.emit("job-progress", job, {
        state: "Rendering",
        progress,
      });
    };

    job = await render(job, settings);

    // update output and status on API
    await updateJob(job.uid, {
      output: { label: "new", src: job.output },
      state: "finished",
      dateFinished: new Date().toISOString(),
    });

    socket.emit("job-progress", job, {
      state: "finished",
    });

  } catch (e) {
    await updateJob(job.uid, {
      state: "error",
      dateFinished: new Date().toISOString(),
      failureReason: e.message,
    });
    socket.emit("job-progress", job, {
      state: "error",
    });
    console.log(e);
  } finally {
    const logPath = `${path.join(process.cwd(), "renders")}/aerender-${job.uid
      }.log`;
    // update logs
    if (fs.existsSync(logPath)) {
      await updateJob(job.uid, {
        logs: { label: "ae", text: fs.readFileSync(logPath, "utf8") },
      });
    }

    runningInstance = null;
    currentJob = null;
  }

  return true;
}