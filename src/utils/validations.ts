import { ICSAIManagerOptions } from "../CSAIManager";

export function validateInitOptions(
  initOptions: ICSAIManagerOptions
): ICSAIManagerOptions {
  if (!initOptions.container && !initOptions.adVideoElement) {
    console.warn(
      "[CSAIManager] container or adVideoElement is expected, choosing the parent of contentVideoElement as container"
    );
    initOptions.container = initOptions.contentVideoElement.parentElement;
  }
  if (initOptions.container && initOptions.adVideoElement) {
    console.warn(
      "[CSAIManager] either container or adVideoElement is expected, not both, choosing the adVideoElement"
    );
    delete initOptions.container;
  }
  if (
    !initOptions.isLive &&
    !initOptions.vmapUrl &&
    !initOptions.adBreakVASTList
  ) {
    console.error("[CSAIManager] vmapUrl or adBreakVASTList is required");
  }
  if (initOptions.vmapUrl && initOptions.adBreakVASTList) {
    console.warn(
      "[CSAIManager] either vmapUrl or adBreakVASTList is expected, not both, choosing the adBreakVASTList"
    );
    delete initOptions.vmapUrl;
  }
  if (
    initOptions.isLive &&
    (initOptions.vmapUrl || initOptions.adBreakVASTList?.length > 1)
  ) {
    console.warn(
      "[CSAIManager] isLive is true, vmapUrl and adBreakVASTList are not expected, ignoring them"
    );
  }
  return initOptions;
}
