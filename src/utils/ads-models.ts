export interface IAdBreakVASTItem {
  timeOffset: number;
  vastUrl: string;
}

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

export enum AdInsertionType {
  ClientSide = "csai",
  ServerSide = "ssai",
}

export enum AdBreakType {
  Preroll = "preroll",
  Midroll = "midroll",
  Postroll = "postroll",
}

export interface AdServerOptions {
  tags: string;
  shares: string;
  flags: string;
  contentForm: string;
  contentId: string;
}

export interface AdMarker {
  position: number;
}

export interface IPauseAd {
  imageSource: string;
  clickthroughUrl?: string;
  impressionUrls: string[];
  clickthroughTrackingUrls: string[];
  errorTrackingUrls: string[];
  trackCollapseUrls: string[];
}

export interface IAdBreak {
  breakType: AdBreakType | string;
  insertionType: AdInsertionType;
  ads: IAd[];
  timeOffset: number;
  trackingEvents?: {
    [key in AdBreakTrackingEvent]?: string[];
  };
}

export enum AdVideoVariant {
  NORMAL = "NORMAL",
  SPONSOR = "BUMPER",
  VIGNETTE = "VIGNETTE",
  TRAILER = "TRAILER",
}

export interface IAd {
  id: string;
  customAdId?: string;
  programmatic?: boolean;
  system?: string;
  sequence?: number;
  title: string;
  variant?: AdVideoVariant;

  creative: IAdCreative;

  errorUrlTemplates?: string[];
  impressionUrlTemplates?: string[];
}

export interface IAdCreative {
  id: string;
  adId?: string;
  type: string;
  duration?: number;
  mediafiles: IAdMediaFile[];
  trackingEvents: {
    [key in AdTrackingEvent]?: string[];
  };
  clickThroughUrlTemplate?: {
    id: string;
    url: string;
  };
}

export interface IAdMediaFile {
  id?: string;
  fileUrl: string;
  mimeType: string;
  bitrate?: number;
  height?: number;
  width?: number;
}

export const UNKNOWN_AD: IAd = {
  id: "unknown_advert",
  title: "",
  creative: {
    id: "unknown_creative",
    type: "?",
    mediafiles: [],
    trackingEvents: {},
  },
};
