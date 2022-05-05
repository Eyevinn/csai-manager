export function dateStringToSeconds(dateString: string): number {
  var p = dateString.split(":"),
    s = 0,
    m = 1;
  while (p.length > 0) {
    s += m * parseInt(p.pop() as string, 10);
    m *= 60;
  }
  return s;
}

export function createAdVideoElement(
  contentVideoElement?: HTMLVideoElement
): HTMLVideoElement {
  const adVideoElement = document.createElement("video");
  adVideoElement.style.position = "absolute";
  adVideoElement.style.top = "0";
  adVideoElement.style.left = "0";
  adVideoElement.style.width = "100%";
  adVideoElement.style.height = "100%";
  adVideoElement.style.backgroundColor = "black";
  adVideoElement.style.display = "none";
  if (contentVideoElement) {
    adVideoElement.muted = contentVideoElement.muted;
    adVideoElement.volume = contentVideoElement.volume;
  }
  return adVideoElement;
}
