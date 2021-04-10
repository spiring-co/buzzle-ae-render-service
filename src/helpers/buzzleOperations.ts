import fetch from "node-fetch";
import * as dotenv from "dotenv";

dotenv.config();
const { API_URL, API_TOKEN } = process.env;

export const updateJob=async (uid, body) => {
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

export const isJobExist=async (uid) => {
  const res = await fetch(`${API_URL}/jobs/${uid}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_TOKEN}`,
    },
  });
  if(res.ok){
    return true
  }else{
    return false
  }
};