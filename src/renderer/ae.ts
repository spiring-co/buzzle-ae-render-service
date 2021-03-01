import * as fs from "fs";
import * as path from "path";
import { io } from "socket.io-client";
import { render } from "@nexrender/core";
import { ChildProcess } from "child_process";

import logger from "../helpers/logger";
import updateJob from "../helpers/updateJob";
import toNexrenderJob from "../helpers/toNexrenderJob";

const { SOCKET_SERVER } = process.env;

const socket = io(SOCKET_SERVER);

let currentJob: string = null;
let runningInstance: ChildProcess = null;

const renderJob = async (job) => {
  const renderPath = path.join(process.cwd(), "renders");
  const consoleLogPath = `${renderPath}/console-${job.id}.log`;
  const aeLogPath = `${renderPath}/aerender-${job.id}.log`;
  const wLogger = logger(socket, job.id, consoleLogPath);

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

  let renderSuccess;

  try {
    // convert to nexrender job
    job = toNexrenderJob(job);
    // add loggers

    settings.logger = wLogger;

    job.onRenderProgress = (job, progress) => {
      socket.emit("job-progress", {
        id: job.id,
        state: "Rendering",
        progress,
      });
    };

    job.onChange = (job, state) => {
      wLogger.log("State changed to: ", state);

      socket.emit("job-progress", job, {
        state,
        dateStarted: new Date().toISOString(),
        dateFinished: new Date().toISOString(),
      });

      updateJob(job.uid, {
        state,
        ...(state === "started"
          ? { dateStarted: new Date().toISOString() }
          : {}),
        ...(state === "finished"
          ? {
              dateFinished: new Date().toISOString(),
              output: { label: "new", src: job.output },
            }
          : {}),
      });
    };

    job = await render(job, settings);
    renderSuccess = true;
  } catch (e) {
    // update error reason
    await updateJob(job.uid, {
      state: "error",
      failureReason: e.message,
    });

    wLogger.error("error", e);
    renderSuccess = false;
  } finally {
    // upload logs
    if (fs.existsSync(aeLogPath)) {
      await updateJob(job.uid, {
        logs: { label: "ae", text: fs.readFileSync(aeLogPath, "utf8") },
      });
    }

    if (fs.existsSync(consoleLogPath)) {
      await updateJob(job.uid, {
        logs: {
          label: "console",
          text: fs.readFileSync(consoleLogPath, "utf8"),
        },
      });
    }

    runningInstance = null;
    currentJob = null;
  }

  return renderSuccess;
};

export default renderJob;
