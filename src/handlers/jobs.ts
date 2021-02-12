import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import toNexrenderJob from "../helpers/toNexrenderJob";
import fetch from "node-fetch";
import { render } from "@nexrender/core";
import { ChildProcess } from "child_process";

dotenv.config();

const { API_URL } = process.env;

let runningInstance: ChildProcess = null;
let currentJob: string = null;

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
  switch (eventType) {
    case "created":
      let job;

      // convert to nexrender job
      try {
        job = toNexrenderJob(data);
      } catch {
        console.log("Couldn't parse job from data rejecting message.");
        return false;
      }

      // update status to started on API
      const response = await updateJob(job.uid, { state: "started" });
      console.log(await response.json());

      // TODO add socket implementation
      job.onRenderProgress = (job, progress) => console.log(progress);

      try {
        job = await render(job, settings);

        // update output and status on API
        const response = await updateJob(job.uid, {
          output: { label: "new", src: job.output },
          state: "finished",
        });
        console.log(await response.json());
      } catch (err) {
        console.error(err);
        throw err;
      }

      // update logs
      await updateJob(job.uid, {
        logs: {
          label: "ae",
          text: fs.readFileSync(
            `${path.join(process.cwd(), "renders")}/aerender-${job.uid}.log`,
            "utf8"
          ),
        },
      });

      runningInstance = null;
      currentJob = null;
      break;

    case "updated":
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
