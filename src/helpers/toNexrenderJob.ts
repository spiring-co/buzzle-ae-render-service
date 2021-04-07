import * as path from 'path'
import * as shortid from "shortid";

const defaultTypes = { image: "png", audio: "mp3", video: "mp4" };
const DEFAULT_SETTINGS_TEMPlATE = "half";
const DEFAULT_OUTPUT_MODULE = "h264";
const DEFAULT_OUTPUT_EXT = "mov";

export default function (job) {
  // find version index
  const versionIndex = job.videoTemplate.versions.findIndex(
    (v) => v.id === job.idVersion
  );
  if (versionIndex === -1) {
    throw new Error("composition with given name does not exist.");
  }

  // convert data to assets
  const assets = [];
  const { fields = null } = job.videoTemplate.versions[versionIndex];

  if(!fields) {
    throw new Error("Version has no fields");

  }
  if (job.data) {
    Object.keys(job.data).map((k) => {
      const field = fields.find((f) => f.key === k);
      if(!field || !field.rendererData) {
        console.warn(`Field ${k} is present in job data but does not exist `);
        return
      }
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
if(!hasFontAction){
 //TODO Deicide font action has to be compulsory or not
 //if yes we had to access fonts from videotemplate or job should be populated here
}

  if (!hasEncodeOption)
    postrender.push({
      module: "buzzle-action-handbrake",
      eraseInput: true,
    });

  postrender = postrender.concat(job.actions.postrender || []);

  postrender = postrender.map(a => {
    if (a.module.includes("buzzle")) {
      return a
    } else {
      return { ...a, module: "buzzle-" + a.module }
    }
  })

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
        ContentType:'video/mp4'
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
      frameIncrement: frameIncrement || incrementFrame,
      incrementFrame: frameIncrement || incrementFrame
    },
    assets: [...job.videoTemplate.staticAssets, ...assets],
    actions: { prerender, postrender },
  };
  return nxJob;
}
