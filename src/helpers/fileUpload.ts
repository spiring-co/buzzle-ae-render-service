import AWS from "aws-sdk";

const bucketName = "spiring-logs";
/**
 * @param  {String} Key Path of the file
 * @param  {} Body File body
 */
export default (Key, Body) => {
  var upload = new AWS.S3.ManagedUpload({
    partSize: 15 * 1024 * 1024,
    queueSize: 5,
    params: {
      Bucket: bucketName,
      Key: Key,
      Body,
      ACL: "public-read",
    },
  });

  return upload;

  /*
  HOW TO USE?

  FOR PROGRESS -> 
  upload.on("httpUploadProgress", ({loaded, total}) => console.log(loaded/total));

  FOR async/await ->
  await upload.promise();
  
  */
};
