// Center-crop the source video to the printed image without stretching it.
export function videoFrame(imageWidth:number,imageHeight:number,videoWidth:number,videoHeight:number){
  const target=imageWidth/imageHeight,source=videoWidth/videoHeight;
  const x=Math.min(1,target/source),y=Math.min(1,source/target);
  return {x,y,offsetX:(1-x)/2,offsetY:(1-y)/2};
}
