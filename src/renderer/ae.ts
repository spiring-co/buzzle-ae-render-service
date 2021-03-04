import * as fs from "fs";
import * as path from "path";
import { io } from "socket.io-client";
import * as rimraf from "rimraf";
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
  const { id } = job;
  const renderPath = path.join(process.cwd(), "renders");
  const consoleLogPath = `${renderPath}/console-${id}.log`;
  const aeLogPath = `${renderPath}/aerender-${id}.log`;
  const wLogger = logger(socket, id, consoleLogPath);

  const settings: any = {
    stopOnError: true,
    workpath: path.join(process.cwd(), "renders"),
    skipCleanup: true,
    addLicense: false,
    debug: true,
    onInstanceSpawn: (instance, job, settings) => {
      runningInstance = instance;
      currentJob = id;
    },
  };

  let renderSuccess = true;
  // convert to nexrender job
  try {
    job = toNexrenderJob(job);

  } catch (e) {
    // update error reason
    await updateJob(id, {
      state: "error",
      failureReason: e.message,
    });
    return false
  }
  // add loggers

  settings.logger = wLogger;

  job.onRenderProgress = (job, progress) => {
    socket.emit("job-progress", {
      id: id,
      state: "Rendering",
      progress,
    });
  };

  job.onChange = (job, state) => {
    wLogger.log("State changed to: " + state);

    socket.emit("job-progress", {
      id: id,
      state,
      ...(state === "render:cleanup"
        ? {
          state: "finished"
        }
        : {}),
    });

    updateJob(id, {
      state,
      ...(state === "render:setup"
        ? { dateStarted: new Date().toISOString(), state: "started" }
        : {}),
      ...(state === "render:cleanup"
        ? {
          dateFinished: new Date().toISOString(),
          output: { label: "new", src: job.output },
          state: "finished"
        }
        : {}),
    });
  };


  job = await render(job, settings).catch(e => {
    renderSuccess = false;

    // update error reason
    updateJob(id, {
      state: "error",
      failureReason: e.message,
    });

    wLogger.error(e.message || e.msg);
    if (fs.existsSync(`${renderPath}/${id}`))
      rimraf.sync(`${renderPath}/${id}`);
  });


  // upload logs
  if (fs.existsSync(aeLogPath)) {
    await updateJob(id, {
      logs: { label: "ae", text: fs.readFileSync(aeLogPath, "utf8") },
    });
  }

  if (fs.existsSync(consoleLogPath)) {
    await updateJob(id, {
      logs: {
        label: "console",
        text: fs.readFileSync(consoleLogPath, "utf8"),
      },
    });
  }

  runningInstance = null;
  currentJob = null;

  if (fs.existsSync(`${renderPath}/${id}`))
    rimraf.sync(`${renderPath}/${id}`);

  return renderSuccess;
}

export default renderJob;
