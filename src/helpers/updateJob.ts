import fetch from "node-fetch";
import * as dotenv from "dotenv";

dotenv.config();
const { API_URL, API_TOKEN } = process.env;

export default async (uid, body) => {
  const res = await fetch(`${API_URL}/jobs/${uid}`, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
  });
  return await res.json();
};
