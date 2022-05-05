import { CSAIManager } from "../index.ts";

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector("eyevinn-video").addEventListener("ready", () => {
    const videoElement = document.querySelector("eyevinn-video").player.video;
    const csaiManager = new CSAIManager({
      debug: true,
      contentVideoElement: videoElement,
      adBreakVASTList: [
        {
          timeOffset: 0,
          vastUrl:
            "https://eyevinn.adtest.eyevinn.technology/api/v1/vast?dur=30",
        },
        {
          timeOffset: 300,
          vastUrl:
            "https://eyevinn.adtest.eyevinn.technology/api/v1/vast?dur=30",
        },
      ],
    });

    csaiManager.on("*", (event, data) => {
      // no-op
    });
  });
});
