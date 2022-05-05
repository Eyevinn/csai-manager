import { VASTParser } from "@dailymotion/vast-client";
import VMAPParser from "@dailymotion/vmap";

import {
  AdBreakType,
  AdInsertionType,
  AdVideoVariant,
  IAd,
  IAdBreak,
  IAdCreative,
  IAdMediaFile,
  AdBreakTrackingEvent,
  AdTrackingEvent,
  IAdBreakVASTItem,
} from "./utils/ads-models";
import { dateStringToSeconds } from "./utils/helpers";

export class AdServerService {
  private debug = false;
  private vastParser: VASTParser;
  private estimatedBandwidth = 500;

  constructor(debug = false) {
    this.debug = !!debug;
    this.vastParser = new VASTParser();
  }

  public async getVMAP(url: string): Promise<IAdBreak[]> {
    if (this.debug) {
      console.debug("[CSAIManager] getVMAP", url);
    }
    const vmapObject = await this.fetchAdsVMAP(url);
    const adBreaks = await this.resolveAds(vmapObject);
    if (this.debug) {
      console.debug("[CSAIManager] resolved VMAP to ad breaks", adBreaks);
    }
    return adBreaks;
  }

  public async getVASTs(vastItems: IAdBreakVASTItem[]): Promise<IAdBreak[]> {
    if (this.debug) {
      console.debug("[CSAIManager] getVASTs", vastItems);
    }
    const adBreaks: IAdBreak[] = [];
    for (const vastItem of vastItems) {
      const vastAdBreak = await this.vastParser.getAndParseVAST(
        vastItem.vastUrl
      );
      if (!vastAdBreak) return;
      const adBreakAds = vastAdBreak.ads;
      adBreaks.push(
        this.mapAdBreakObject(
          { timeOffset: vastItem.timeOffset.toString() },
          adBreakAds
        )
      );
    }
    if (this.debug) {
      console.debug("[CSAIManager] resolved VAST to ad break", adBreaks);
    }
    return adBreaks;
  }

  public async getVast(vastUrl: string): Promise<IAdBreak> {
    if (this.debug) {
      console.debug("[CSAIManager] get vast", vastUrl);
    }
    const vastAdBreak = await this.vastParser.getAndParseVAST(vastUrl);
    if (!vastAdBreak) return;
    const adBreakAds = vastAdBreak.ads;
    const adbreak = this.mapAdBreakObject({ timeOffset: "100" }, adBreakAds);
    if (this.debug) {
      console.debug("[CSAIManager] resolved vast to ad break", adbreak);
    }
    return adbreak;
  }

  private async fetchAdsVMAP(u: string): Promise<Record<string, any>> {
    const response = await fetch(u);
    const xml = await response.text();
    const xmlParser = new DOMParser();
    const xmlDoc = xmlParser.parseFromString(xml, "text/xml");
    const vmapObject = new VMAPParser(xmlDoc);
    return vmapObject;
  }

  private async resolveAds(
    vmapObject: Record<string, any>
  ): Promise<IAdBreak[]> {
    const adBreaks: IAdBreak[] = [];
    for (const adBreak of vmapObject.adBreaks) {
      if (adBreak.breakType !== "linear") return adBreaks;
      const adsInBreak = adBreak.adSource?.vastAdData;
      let adBreakAds = [];
      if (adsInBreak) {
        const options = {
          isRootVAST: true,
          timeout: 10 * 1000,
          withCredentials: true,
          wrapperLimit: 10,
          followAdditionalWrappers: true,
        };
        this.vastParser.initParsingStatus(options);
        adBreakAds = (
          await this.vastParser.parseVAST(
            { documentElement: adsInBreak },
            options
          )
        ).ads;
        this.estimatedBandwidth = this.vastParser.getEstimatedBitrate();
      }
      adBreaks.push(this.mapAdBreakObject(adBreak, adBreakAds));
    }
    return adBreaks;
  }

  private mapAdBreakObject(adBreak: any, ads: any[]): IAdBreak {
    const adBreakObject: IAdBreak = {
      insertionType: AdInsertionType.ClientSide,
      breakType:
        adBreak.timeOffset === "start" || adBreak.timeOffset === "0"
          ? AdBreakType.Preroll
          : AdBreakType.Midroll,
      timeOffset:
        adBreak.timeOffset === "start" || adBreak.timeOffset === "0"
          ? 0
          : dateStringToSeconds(adBreak.timeOffset),
      ads: ads
        ?.map((ad) => this.mapAdsObject(ad))
        .filter((ad): ad is IAd => ad !== null),
      trackingEvents: {
        breakStart:
          adBreak.trackingEvents
            ?.filter((abte) => abte.event === AdBreakTrackingEvent.BREAK_START)
            ?.map((abte) => abte.uri) || [],
        breakEnd:
          adBreak.trackingEvents
            ?.filter((abte) => abte.event === AdBreakTrackingEvent.BREAK_END)
            ?.map((abte) => abte.uri) || [],
      },
    };
    return adBreakObject;
  }

  private mapAdsObject(ad: any): IAd | null {
    const adServerExtension = ad.extensions.find(
      (extension) => extension.attributes.type === "AdServer"
    );

    const customAdId =
      adServerExtension?.children.find((ext) => ext.name === "AdInfo")
        ?.attributes?.customaid || undefined;

    const variant =
      adServerExtension?.children.find((ext) => ext.name === "AdInfo")
        ?.attributes?.variant || AdVideoVariant.NORMAL;

    const creative = this.findCreative(
      ad.creatives.map((creative) => this.mapCreativeObject(creative))
    );

    if (!creative) {
      return null;
    }

    const adObject: IAd = {
      id: ad.id,
      customAdId: customAdId,
      programmatic: customAdId === "PROGRAMMATIC",
      system: ad.system?.value,
      sequence: ad.sequence,
      title: ad.title,
      variant,
      creative,
      errorUrlTemplates: ad.errorURLTemplates,
      impressionUrlTemplates: ad.impressionURLTemplates.map(
        (impressionUrlTemplate) => impressionUrlTemplate.url
      ),
    };
    return adObject;
  }

  private findCreative(creatives: IAdCreative[]): IAdCreative | undefined {
    return creatives.find(
      (creative) => creative.type === "linear" && creative.mediafiles.length > 0
    );
  }

  private mapCreativeObject(creative: any): IAdCreative {
    const creativeObject: IAdCreative = {
      id: creative.id,
      adId: creative.adId,
      type: creative.type,
      duration: creative.duration,
      mediafiles: this.filterMediaFiles(
        creative.mediaFiles.map((mediaFile) =>
          this.mapMediaFileObject(mediaFile)
        )
      ),
      trackingEvents: {
        [AdTrackingEvent.CLICK_THROUGH]: [
          ...creative.videoClickTrackingURLTemplates,
        ],
        ...creative.trackingEvents,
      },
      clickThroughUrlTemplate: creative.videoClickThroughURLTemplate,
    };
    return creativeObject;
  }

  private filterMediaFiles(mediaFiles: IAdMediaFile[]): IAdMediaFile[] {
    const playableMediaFiles = mediaFiles.filter(
      (mediaFile) => mediaFile.mimeType === "video/mp4"
    );
    let files = playableMediaFiles.filter(
      (mediaFile) =>
        mediaFile.mimeType === "video/mp4" &&
        mediaFile.fileUrl.length > 0 &&
        (!mediaFile.bitrate || mediaFile.bitrate < this.estimatedBandwidth)
    );
    // if no files are found, return the lowest one
    if (files.length === 0) {
      files = playableMediaFiles;
    }
    // otherwise return the filtered list top down
    return files.sort((a, b) =>
      a.bitrate && b.bitrate ? a.bitrate - b.bitrate : 0
    );
  }

  private mapMediaFileObject(mediaFile: any): IAdMediaFile {
    const mediaFileObject: IAdMediaFile = {
      id: mediaFile.id,
      mimeType: mediaFile.mimeType,
      fileUrl: mediaFile.fileURL,
      bitrate: mediaFile.bitrate,
      height: mediaFile.height,
      width: mediaFile.width,
    };
    return mediaFileObject;
  }
}
