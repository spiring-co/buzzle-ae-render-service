module.exports = {
  compress: {
    module: "@nexrender/action-encode",
    preset: "mp4",
    output: "encoded.mp4",
  },
  installFonts: (fonts) => ({
    module: "action-install-fonts",
    fonts,
  }),
  caching: {
    module: "action-caching",
    name: "a1122786a8ce9aa1ec59166ae03c3e3a",
    path: "https://bulaava-assets.s3.amazonaws.com/help.json",
  },
  addWaterMark: {
    module: "action-watermark",
    input: "encoded.mp4",
    watermark: "http://assets.stickpng.com/images/5cb78678a7c7755bf004c14c.png",
    output: "watermarked.mp4",
  },
  mergeVideos: {
    //make changes
    module: "action-mergeVideos",
    input: "watermarked.mp4",
    f1: "mp4",
    input2: "watermarked.mp4",
    f2: "mp4",
    output: "merged.mp4",
  },
  addAudio: {
    module: "action-addAudio",
    inputV:
      "https://file-examples.com/wp-content/uploads/2017/04/file_example_MP4_480_1_5MG.mp4",
    inputA:
      "https://file-examples.com/wp-content/uploads/2017/11/file_example_MP3_700KB.mp3",
    output: "audioed.mp4",
  },
  upload: (filename, type) => ({
    module: "@nexrender/action-upload",
    input: type === "watermark" ? "watermarked.mp4" : "encoded.mp4",
    provider: "s3",
    params: {
      region: "us-east-1",
      bucket: "bulaava-assets",
      key: `outputs/${
        type === "watermark" ? `watermarked${filename}` : filename
      }.mp4`,
      //TODO better acl policy
      acl: "public-read",
    },
  }),
};
