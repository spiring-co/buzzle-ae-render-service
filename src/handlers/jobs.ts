import * as dotenv from "dotenv";
import * as _ from "lodash";
import renderJob from "../renderer/ae";
import { isJobExist } from "../helpers/buzzleOperations";

dotenv.config();

// returns true if consumed message successfully
export default async function (data: any, eventType: string): Promise<boolean> {
  // console.log(eventType, _.pick(data, ["updates", "extra"], data.job.id))
  let { job, updates = false, extra = false } = data;
  //check if job still there (not deleted)
  let jobExists = true
  try {
    jobExists = await isJobExist(job?.id)
    console.log("Job Exist:", jobExists)
  } catch (err) {
    console.log("Error in fetching job exist:", err)
  }
  if (jobExists && job?.id) {
    switch (eventType) {
      case "created":
        return await renderJob(job);

      case "updated":
        if (extra?.forceRerender) {
          return await renderJob(job);
        }

        if (_.has(updates, "data")) {
          return await renderJob(job);
        }

        if (_.has(updates, "actions")) {
          return await renderJob(job);
        }

        if (_.has(updates, "renderPrefs")) {
          return await renderJob(job);
        }

        break;

      case "deleted":
        break;
    }
    return true
  } else {
    return false
  }

}
