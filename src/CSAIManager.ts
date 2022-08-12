import { AdServerService } from "./AdServerService";
import {
  AdBreakTrackingEvent,
  AdTrackingEvent,
  IAd,
  IAdBreak,
  IAdBreakVASTItem,
} from "./utils/ads-models";
import { EmitterBaseClass } from "./utils/EmitterBaseClass";
import { createAdVideoElement } from "./utils/helpers";
import { validateInitOptions } from "./utils/validations";

import { VideoEventFilter, PlayerEvents } from "@eyevinn/video-event-filter";

export interface ICSAIManagerOptions {
  contentVideoElement: HTMLVideoElement;
  autoManagePlayback?: boolean;
  autoplay?: boolean;
  isLive?: boolean;

  container?: HTMLElement;
  adVideoElement?: HTMLVideoElement;

  vmapUrl?: string;
  adBreakVASTList?: IAdBreakVASTItem[];

  debug?: boolean;
}

export class CSAIManager extends EmitterBaseClass {
  private debug = false;
  private initOptions: ICSAIManagerOptions;

  private state: "idle" | "playing" | "paused" | "ended";

  private contentVideoElement: HTMLVideoElement;
  private adVideoElement: HTMLVideoElement;
  private autoManagePlayback = true;

  private adVideoEventFilter: VideoEventFilter;

  private adServerService: AdServerService;
  private adBreaks: IAdBreak[] = [];
  private adMarkers: number[] = [];

  private currentAdBreak: IAdBreak;
  private currentAdBreakVideos: IAd[] = [];
  private currentAd: IAd;

  private onContentVolumeChangeRef: any;
  private onContentTimeUpdateRef: any;
  private onAdSeekingRef: any;

  private validCurrentTime = 0;

  private trackedAdBreaks: {
    [timeOffset: number]: {
      [key: string]: true;
    };
  } = {};
  private trackedAds: {
    [adId: string]: {
      [key: string]: true;
    };
  } = {};

  constructor(initOptions: ICSAIManagerOptions) {
    super();
    this.debug = !!initOptions.debug;
    this.initOptions = initOptions;

    this.state = "idle";

    this.adServerService = new AdServerService(this.debug);
    initOptions = validateInitOptions(initOptions);

    if (this.autoManagePlayback) {
      initOptions.contentVideoElement.pause();
    }

    this.contentVideoElement = initOptions.contentVideoElement;
    this.adVideoElement = this.setupAdVideoElement(initOptions);
    this.adVideoEventFilter = new VideoEventFilter(this.adVideoElement);
    // we should try to match the settings of the content video element if changed through e.g. a skin implementation
    this.contentVideoElement.addEventListener(
      "volumechange",
      (this.onContentVolumeChangeRef = this.onContentVolumeChange.bind(this))
    );

    this.autoManagePlayback = initOptions.autoManagePlayback
      ? initOptions.autoManagePlayback
      : true;

    this.fetchAds(initOptions);
  }

  private setupAdVideoElement(
    initOptions: ICSAIManagerOptions
  ): HTMLVideoElement {
    if (initOptions.adVideoElement) {
      return initOptions.adVideoElement;
    }
    if (initOptions.container) {
      const adVideoElement = createAdVideoElement(this.contentVideoElement);
      initOptions.container.appendChild(adVideoElement);
      return adVideoElement;
    }
  }

  private async fetchAds(initOptions: ICSAIManagerOptions): Promise<void> {
    if (initOptions.isLive && initOptions.adBreakVASTList?.length > 1) return;
    if (initOptions.vmapUrl) {
      this.adBreaks = await this.adServerService.getVMAP(initOptions.vmapUrl);
    }
    if (initOptions.adBreakVASTList) {
      this.adBreaks = await this.adServerService.getVASTs(
        initOptions.adBreakVASTList
      );
    }

    this.adBreaks = this.adBreaks.sort((a, b) => a.timeOffset - b.timeOffset);
    this.adMarkers = this.adBreaks.map((adBreak) => adBreak.timeOffset);
    this.start();
  }

  public play(): void {
    if (this.state === "idle") {
      this.state = "playing";
      this.playNextVideo();
    }
    if (this.state === "paused") {
      this.adVideoElement.play();
    }
  }

  public pause(): void {
    if (this.state !== "playing") return;
    this.adVideoElement.pause();
  }

  public async fetchAdBreak(vastUrl: string): Promise<void> {
    const adBreak = await this.adServerService.getVast(vastUrl);
    if (adBreak) {
      this.adBreaks.push(adBreak);
    }
  }

  public async triggerAdBreak(): Promise<void> {
    if (!this.adBreaks || this.adBreaks.length === 0) return;
    this.playAdBreak(this.adBreaks.shift());
  }

  private start(): void {
    if (this.adMarkers[0] === 0) {
      this.adMarkers.shift();
      this.playAdBreak(this.adBreaks.shift());
    } else {
      const nextBreak = this.adMarkers.find(
        (adMarker) => adMarker > this.contentVideoElement.currentTime
      );
      if (!nextBreak) return;
      this.contentVideoElement.addEventListener(
        "timeupdate",
        (this.onContentTimeUpdateRef = this.onContentTimeUpdate.bind(this))
      );
    }
  }

  private playAdBreak(adbreak: IAdBreak): void {
    if (this.autoManagePlayback) {
      this.contentVideoElement.pause();
    }
    this.currentAdBreak = adbreak;
    this.trackAdBreakEvent(
      this.currentAdBreak,
      AdBreakTrackingEvent.BREAK_START
    );
    for (const ad of adbreak.ads) {
      this.currentAdBreakVideos.push(ad);
    }
    this.playNextVideo();
  }

  private playNextVideo() {
    this.adVideoEventFilter.clear();
    this.adVideoElement.removeEventListener("seeking", this.onAdSeekingRef);

    const ad = this.currentAdBreakVideos.shift();
    if (ad) {
      this.playAd(ad);
    } else {
      this.playContent();
    }
  }

  private playAd(ad: IAd): void {
    const src = ad.creative.mediafiles[0].fileUrl;
    if (this.debug) {
      console.debug("[CSAIManager] play ad", ad);
    }
    if (!src) return this.playNextVideo();
    this.currentAd = ad;
    this.adVideoElement.style.display = "block";
    this.adVideoElement.src = src;

    if (this.state !== "idle" || this.initOptions.autoplay) {
      this.adVideoElement.play();
    }

    this.adVideoElement.addEventListener(
      "playing",
      () => {
        this.trackEvent(AdTrackingEvent.START, this.currentAd);
        this.trackEvent(AdTrackingEvent.IMPRESSION, this.currentAd);
        this.state = "playing";
      },
      { once: true }
    );
    this.adVideoElement.addEventListener(
      "ended",
      () => {
        this.trackEvent(AdTrackingEvent.COMPLETE, this.currentAd);
        this.state = "ended";
        this.validCurrentTime = 0;
        this.playNextVideo();
      },
      { once: true }
    );

    this.adVideoEventFilter.addEventListener(PlayerEvents.TimeUpdate, () => {
      if (!this.adVideoElement.seeking) {
        this.validCurrentTime = this.adVideoElement.currentTime;
      }
      this.monitorProgress();
    });
    this.adVideoEventFilter.addEventListener(PlayerEvents.Pause, () => {
      this.state = "paused";
      this.trackEvent(AdTrackingEvent.PAUSE, this.currentAd);
    });
    this.adVideoEventFilter.addEventListener(PlayerEvents.Resume, () => {
      this.state = "playing";
      this.trackEvent(AdTrackingEvent.RESUME, this.currentAd);
    });
    this.adVideoEventFilter.addEventListener(PlayerEvents.Error, () => {
      this.trackEvent(AdTrackingEvent.ERROR, this.currentAd);
    });

    // this has to be native to block seek properly
    this.adVideoElement.addEventListener(
      "seeking",
      (this.onAdSeekingRef = () => {
        const delta = this.adVideoElement.currentTime - this.validCurrentTime;
        if (Math.abs(delta) > 0.01) {
          this.adVideoElement.currentTime = this.validCurrentTime;
        }
      })
    );
  }

  private playContent() {
    if (this.debug) {
      console.debug("[CSAIManager] play content");
    }
    this.adVideoElement.style.display = "none";
    this.adVideoElement.src = "";

    if (this.currentAdBreak) {
      this.trackAdBreakEvent(
        this.currentAdBreak,
        AdBreakTrackingEvent.BREAK_END
      );
      this.currentAdBreak = null;
    }

    if (this.autoManagePlayback) {
      this.contentVideoElement.play();
    }

    const nextBreak = this.adMarkers.find(
      (adMarker) => adMarker > this.contentVideoElement.currentTime
    );
    if (!nextBreak) return;
    if (this.debug) {
      console.debug("[CSAIManager] waiting for next break", nextBreak);
    }
    this.contentVideoElement.addEventListener(
      "timeupdate",
      (this.onContentTimeUpdateRef = this.onContentTimeUpdate.bind(this))
    );
  }

  private onContentVolumeChange() {
    this.adVideoElement.muted = this.contentVideoElement.muted;
    this.adVideoElement.volume = this.contentVideoElement.volume;
  }

  private onContentTimeUpdate() {
    const currentTime = this.contentVideoElement.currentTime;
    const nextBreak = this.adMarkers[0];
    if (currentTime > nextBreak) {
      this.contentVideoElement.removeEventListener(
        "timeupdate",
        this.onContentTimeUpdateRef
      );
      this.adMarkers.shift();
      this.playAdBreak(this.adBreaks.shift());
    }
  }

  private monitorProgress(): void {
    const currentTime = this.adVideoElement.currentTime;
    const duration = this.adVideoElement.duration;
    if (!this.currentAd) return;
    const remainingTime = duration - currentTime;
    const percentWatched = Math.round(100 - (100 * remainingTime) / duration);
    const TrackingCuePoints: { [key: number]: AdTrackingEvent } = {
      25: AdTrackingEvent.FIRST_QUARTILE,
      50: AdTrackingEvent.MIDPOINT,
      75: AdTrackingEvent.THIRD_QUARTILE,
    };
    Object.keys(TrackingCuePoints).map((value) => {
      const event: AdTrackingEvent = TrackingCuePoints[value];
      if (percentWatched > parseInt(value, 10) && this.currentAd) {
        this.trackEvent(event, this.currentAd);
      }
    });
  }

  private trackAdBreakEvent(
    adBreak: IAdBreak,
    trackingEvent: AdBreakTrackingEvent
  ): void {
    if (
      !adBreak ||
      !adBreak.trackingEvents ||
      !trackingEvent ||
      (this.trackedAdBreaks[adBreak.timeOffset] &&
        this.trackedAdBreaks[adBreak.timeOffset][trackingEvent] === true)
    )
      return;
    if (!this.trackedAdBreaks[adBreak.timeOffset])
      this.trackedAdBreaks[adBreak.timeOffset] = {};

    this.emit(trackingEvent, adBreak);

    const trackingUrls = adBreak.trackingEvents[trackingEvent] || [];
    trackingUrls.forEach(async (url: string) => {
      if (this.debug) {
        console.debug(
          `[CSAIManager] ad break tracking event -> ${trackingEvent}`,
          url
        );
      }
      new Image().src = url;
    });
    this.trackedAdBreaks[adBreak.timeOffset][trackingEvent] = true;
  }

  private trackEvent(trackingEvent: AdTrackingEvent, ad: IAd): void {
    if (
      !ad ||
      !trackingEvent ||
      (this.trackedAds[ad.id] && this.trackedAds[ad.id][trackingEvent] === true)
    )
      return;
    if (!this.trackedAds[ad.id]) this.trackedAds[ad.id] = {};
    let trackingUrls: string[] = [];
    switch (trackingEvent) {
      case AdTrackingEvent.IMPRESSION:
        trackingUrls = ad.impressionUrlTemplates || [];
        break;
      case AdTrackingEvent.ERROR:
        trackingUrls = ad.errorUrlTemplates || [];
        break;
      default:
        trackingUrls = ad.creative.trackingEvents[trackingEvent] || [];
        break;
    }

    this.emit(trackingEvent, ad);

    trackingUrls?.forEach(async (url: string) => {
      if (this.debug) {
        console.debug(
          `[CSAIManager] ad tracking event -> ${trackingEvent}`,
          url
        );
      }
      new Image().src = url;
    });
    this.trackedAds[ad.id][trackingEvent] = true;
  }

  destroy() {
    this.adBreaks = [];
    this.adMarkers = [];

    this.currentAd = null;
    this.currentAdBreak = null;
    this.currentAdBreakVideos = [];

    this.onContentVolumeChangeRef = null;
    this.onContentTimeUpdateRef = null;
    this.onAdSeekingRef = null;

    this.trackedAdBreaks = {};
    this.trackedAds = {};

    this.adVideoEventFilter.clear();
    this.adVideoEventFilter.destroy();
    // if not sent in as a video element already in DOM, let's remove the created ad video element as well
    if (!this.initOptions.adVideoElement) {
      this.adVideoElement.remove();
    }
  }
}
