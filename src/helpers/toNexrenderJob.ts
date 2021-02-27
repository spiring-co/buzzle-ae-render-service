import * as path from 'path'
import * as shortid from "shortid";
// const { compress, upload, installFonts } = require("./defaultNexrenderActions");

const defaultTypes = { image: "png", audio: "mp3", video: "mp4" };
const DEFAULT_SETTINGS_TEMPlATE = "half";
const DEFAULT_OUTPUT_MODULE = "h264";
const DEFAULT_OUTPUT_EXT = "mov";

export default function (job) {
  // find version index
  console.log(job)

  const versionIndex = job.videoTemplate.versions.findIndex(
    (v) => v.id === job.idVersion
  );
  if (versionIndex === -1) {
    throw new Error("composition with given name does not exist.");
  }

  // convert data to assets
  const assets = [];
  const { fields } = job.videoTemplate.versions[versionIndex];

  if (job.data) {
    Object.keys(job.data).map((k) => {
      const field = fields.find((f) => f.key === k);

      let asset = field.rendererData;

      if (["file", "image", "audio", "video"].includes(field.type)) {
        asset = { ...asset, src: job.data[k] };

        if (!asset.extension) {
          asset.extension = path.extname(asset.src) || defaultTypes[asset.type];
        }

        if (!asset.name) {
          // asset.name = path.basename(asset.src, `${path.extname(asset.src)}`);
          asset.name = shortid.generate();
        }
      } else {
        asset = { ...asset, value: job.data[k] };
      }
      assets.push(asset);
    });
  }

  if (!job.actions) {
    job.actions = { prerender: [], postrender: [] };
  }

  const prerender = job.actions.prerender || [];

  const hasFontAction = job.actions.prerender.some(
    (a) => a.module === "buzzle-action-install-fonts"
  );
  // if (job.videoTemplate.fonts.length && !hasFontAction)
  //   prerender.push(installFonts(job.videoTemplate.fonts));

  let postrender = [];

  const hasEncodeOption = job.actions.postrender.some(
    (a) => a.module === "buzzle-action-handbrake"
  );
  if (!hasEncodeOption)
    postrender.push({
      module: "buzzle-action-handbrake",
      eraseInput: true,
    });

  postrender = postrender.concat(job.actions.postrender || []);

  const hasUploadAction = job.actions.postrender.some(
    (a) => a.module === "buzzle-action-upload"
  );
  if (!hasUploadAction)
    postrender.push({
      module: "buzzle-action-upload",
      provider: "s3",
      params: {
        region: "us-east-1",
        bucket: "spiring-creator",
        key: `outputs/${job.id}_${Date.now()}.mp4`,
        acl: "public-read",
      },
    });

  const {
    settingsTemplate = DEFAULT_SETTINGS_TEMPlATE,
    outputModule = DEFAULT_OUTPUT_MODULE,
    outputExt = DEFAULT_OUTPUT_EXT,
    frameStart,
    frameEnd,
    frameIncrement,
    incrementFrame
  } = job.renderPrefs || {};

  const nxJob = {
    uid: job.id,
    template: {
      src: job.videoTemplate.src,
      composition: job.videoTemplate.versions[versionIndex].composition,
      continueOnMissing: true,
      settingsTemplate,
      outputModule,
      outputExt,
      frameEnd,
      frameStart,
      frameIncrement:frameIncrement || incrementFrame,
      incrementFrame:frameIncrement || incrementFrame
    },
    assets: [...job.videoTemplate.staticAssets, ...assets],
    actions: { prerender, postrender },
  };
  console.log(nxJob)
  return nxJob;
}
