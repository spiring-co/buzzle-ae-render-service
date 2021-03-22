import * as fs from "fs";
import * as path from "path";
import { io } from "socket.io-client";
import * as rimraf from "rimraf";
import { render } from "@nexrender/core";
import { ChildProcess } from "child_process"
import logger from "../helpers/logger";
import updateJob from "../helpers/updateJob";
import toNexrenderJob from "../helpers/toNexrenderJob";
import getInstanceInfo from "../helpers/instanceInfo"
import fileUpload from "../helpers/fileUpload"
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
  let timeline = []
  let startedTime = Date.now()
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
  let instanceId = '', ipv4 = ''
  try {
    ({ instanceId, ipv4 } = await getInstanceInfo())
  } catch (err) {
    console.log(err)
  }
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
  job.actions.prerender= job.actions.prerender.map((action) => {
    action.onStart = () => {
    timeline.push({ state: `render:prerender:${action.module}`, startsAt: Date.now() })
    }
    action.onComplete = () => {
      timeline= timeline.map(d => d.state === `render:prerender:${action.module}` ? ({ ...d, endsAt: Date.now() }) : d)
    }

    return action
  })

  job.actions.postrender=job.actions.postrender.map((action) => {
    action.onStart = () => {
     timeline.push({ state: `render:postrender:${action.module}`, startsAt: Date.now(), endsAt: Date.now() })
    }
    action.onComplete = () => {
      timeline= timeline.map(d => d.state === `render:postrender:${action.module}` ? ({ ...d, endsAt: Date.now() }) : d)
    }

    return action
  })

  job.onRenderProgress = (job, progress) => {
   timeline= timeline.map(d => d.state === 'Rendering' ? ({ ...d, endsAt: Date.now() }) : d)
    socket.emit("job-progress", {
      id: id,
      state: "Rendering",
      progress,
      rendererInstance: { ipv4, instanceId }
    });
  };

  job.onChange = (job, state) => {
    wLogger.log("State changed to: " + state);
    const stateChangedAt = Date.now()
    if(timeline.length){
      console.log("Setting End time for this ",timeline[timeline.length - 1].state)
    timeline[timeline.length - 1].endsAt = stateChangedAt
    }
    if (state === "render:setup") {
      timeline.push({
        state: "started",
        startsAt: stateChangedAt,
        endsAt: stateChangedAt
      })
    } else if (state === "render:cleanup") {
      timeline.push({
        state: "finished",
        startsAt: stateChangedAt,
        endsAt: stateChangedAt
      })
      console.log(timeline)
    } else if (state === 'render:dorender') {
      timeline.push({
        state: "Rendering",
        startsAt: stateChangedAt,
        endsAt: stateChangedAt
      })
    }
    else if (state === 'render:prerender') {
      //state will be setup from callbacks
    } else if (state === 'render:postrender') {
      //state will be setup from callbacks
    }
    else {
      timeline.push({ state, startsAt: stateChangedAt, endsAt: stateChangedAt })
    }

    socket.emit("job-progress", {
      id: id,
      state,
      rendererInstance: { ipv4, instanceId },
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
          timeline,
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
    const file = fs.readFileSync(aeLogPath, "utf8");
    const task = await fileUpload(`${Date.now()}log_file_ae_${id}.txt`, file)
    const { Location: url } = await task.promise()
    await updateJob(id, {
      logs: {
        label: "ae",
        text: url,
        rendererInstance: { ipv4, instanceId }
      },
    });
  }

  if (fs.existsSync(consoleLogPath)) {
    const file = fs.readFileSync(consoleLogPath, "utf8");
    const task = await fileUpload(`${Date.now()}log_file_console_${id}.txt`, file)
    const { Location: url } = await task.promise()
    await updateJob(id, {
      logs: {
        label: "console",
        text: url,
        rendererInstance: { ipv4, instanceId }
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
