import AWS from "aws-sdk";
const tagsByUseCase = {
  'archive': 'true',
  "deleteAfter7Days": '1 week',
  "deleteAfter90Days": '90 Days'
}
const bucketName = "spiring-creator";
/**
 * @param  {String} Key Path of the file
 * @param  {} Body File body
 */
export default (Key, Body, tag = 'archive') => {
  console.log([tagsByUseCase[tag]])
  var upload = new AWS.S3.ManagedUpload({
    partSize: 15 * 1024 * 1024,
    queueSize: 5,
    params: {
      Bucket: bucketName,
      Key: Key,
      Body,
      ACL: "public-read",
    },
    tags: [{ Key:tag,Value:tagsByUseCase[tag]}]
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
