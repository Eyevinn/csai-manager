CSAI Manager
===

Simple class to conduct and manage the relation between content playback and an ad experience applied on top - client side.

## Installation

`npm install @eyevinn/csai-manager`

## Basic Usage

```js
const videoElement = document.querySelector("video");
new CSAIManager({
  contentVideoElement: videoElement,
  adBreakVASTList: [
    {
      timeOffset: 0,
      vastUrl:
        "https://eyevinn.adtest.eyevinn.technology/api/v1/vast?dur=30",
    },
  ],
});

videoElement.addEventListener("ended", () => {
  csaiManager.destroy();
});
```

If you *do not* send in an already created ad video element (through the available option listed below), but let the library create the element, you will need to set the container to `position: relative;` as the CSAI Manager will try to position the new element absolute edge to edge of the container.

### Available Options

```ts
export interface ICSAIManagerOptions {
  debug?: boolean;

  contentVideoElement: HTMLVideoElement;
  autoManagePlayback?: boolean; // default true; whether you want the manager to pause/play the content, or if you want to act on the events
  isLive?: boolean; // default false; will adjust the validation to not require vast or vmap url etc
  autoplay?: boolean; // default false

  // Whether you have created a video element for the ads on beforehand, or would want to render it in a div. As fallback it finds the parent of the contentVideoElement
  container?: HTMLElement;
  adVideoElement?: HTMLVideoElement;

  // For fetching ads - either provide a vmap url, or a list of time offsets and vast url's
  vmapUrl?: string;
  adBreakVASTList?: IAdBreakVASTItem[];
}

export interface IAdBreakVASTItem {
  timeOffset: number;
  vastUrl: string;
}
```

### Events

You may listen to events exposed by the ad manager, to for instance handle the pause and play of your content yourself.

```js
const videoElement = document.querySelector("video");
const csaiManager = new CSAIManager({
  contentVideoElement: videoElement,
  adBreakVASTList: [
    {
      timeOffset: 0,
      vastUrl:
        "https://eyevinn.adtest.eyevinn.technology/api/v1/vast?dur=30",
    },
  ],
});

csaiManager.on("*", (event, data) => {

  console.log("DEBUG EVENT", event, data);

  if (event === "breakStart") {
    videoElement.pause();
  }
  if (event === "breakEnd") {
    videoElement.play();
  }
});
```

The events exposed are matching the VAST tracking - i.e. IAB events

```ts
export enum AdTrackingEvent {
  START = "start",
  IMPRESSION = "impression",
  EXPAND = "expand",
  MUTE = "mute",
  UNMUTE = "unmute",
  PAUSE = "pause",
  RESUME = "resume",
  REWIND = "rewind",
  CLOSE = "close",
  COMPLETE = "complete",

  FIRST_QUARTILE = "firstQuartile",
  MIDPOINT = "midpoint",
  THIRD_QUARTILE = "thirdQuartile",

  CLICK_THROUGH = "clickThrough",

  ERROR = "error",
}

export enum AdBreakTrackingEvent {
  BREAK_START = "breakStart",
  BREAK_END = "breakEnd",
}
```

### Methods

- `play()` to trigger play when autoplay isn't set to true or play when paused
- `pause()` to pause the ad video playback

These methods are specifically to be used for live
(remember to set the initOption `autoManagePlayback` to `false` to not pause the live stream)

- `fetchAdBreak(vastUrl: string): Promise<void>`
- `triggerAdBreak(): Promise<void>`

### Example usage with custom skin

```js
const videoElement = document.querySelector("video");
const csaiManager = new CSAIManager(opts);

const playButton = document.querySelector("button#play");
const pauseButton = document.querySelector("button#pause");
const mediaPlaying = "content";

csaiManager.on("*", (event, data) => {
  if (event === "breakStart") {
    mediaPlaying = "ads";
  }
  if (event === "breakEnd") {
    mediaPlaying = "content";
  }
});

playButton.addEventListener("click", () => {
  if (mediaPlaying === "content") {
      videoElement.play()    
  }
  if (mediaPlaying === "ads") {
    csaiManager.play();
  }
});
pauseButton.addEventListener("click", () => {
  if (mediaPlaying === "content") {
      videoElement.pause()    
  }
  if (mediaPlaying === "ads") {
    csaiManager.pause();
  }
});
```
