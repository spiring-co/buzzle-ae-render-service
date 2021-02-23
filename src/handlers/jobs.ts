import * as fs from "fs";
import * as path from "path";
import fetch from "node-fetch";
import * as dotenv from "dotenv";
import { io } from "socket.io-client";
import { render } from "@nexrender/core";
import { ChildProcess } from "child_process";
import toNexrenderJob from "../helpers/toNexrenderJob";

dotenv.config();
const { API_URL, SOCKET_SERVER } = process.env;

const socket = io(SOCKET_SERVER);

let currentJob: string = null;
let runningInstance: ChildProcess = null;

const settings = {
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

// returns true if consumed message successfully
export default async function (data: any, eventType: string): Promise<boolean> {
  
  let job;

  switch (eventType) {
    case "created":
      try {
        // convert to nexrender job
        job = toNexrenderJob(data);

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
        const logPath = `${path.join(process.cwd(), "renders")}/aerender-${
          job.uid
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

    case "updated":
      console.log(data)
      break;

    case "deleted":
      break;
  }

  return true;
}

const updateJob = (uid, body) => {
  return fetch(`${API_URL}/jobs/${uid}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization:
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Im9XSXRWSE5xOCIsImVtYWlsIjoic2hpdmFtLjExOTk2NkB5YWhvby5jb20iLCJuYW1lIjoic2hpdmFtIHR5YWdpIiwicm9sZSI6IlVzZXIiLCJpbWFnZVVybCI6Imh0dHBzOi8vaW1hZ2VzLnVuc3BsYXNoLmNvbS9waG90by0xNjAwNjA0NDc3MzcxLTdmMmRkZjc4MmEyYj9peGxpYj1yYi0xLjIuMSZhdXRvPWZvcm1hdCZmaXQ9Y3JvcCZ3PTYxOSZxPTgwIiwiaWF0IjoxNjEyNDI1MzMyLCJleHAiOjE2MTUwMTczMzJ9.2otjeKSiQssL9BfLDJZq6mDehgFYUCzOJxZYIHllTQw",
    },
  });
};
