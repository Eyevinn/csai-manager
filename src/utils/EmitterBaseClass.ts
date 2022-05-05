import mitt, { Emitter } from "mitt";
import { AdBreakTrackingEvent, AdTrackingEvent } from "./ads-models";

export class EmitterBaseClass {
  emitter: Emitter<Record<AdTrackingEvent | AdBreakTrackingEvent, unknown>>;
  constructor() {
    this.emitter = mitt();
  }

  on(event, handler) {
    this.emitter.on.apply(this, [event, handler]);
  }

  off(event, handler) {
    if (this.emitter) {
      this.emitter.off.apply(this, [event, handler]);
    }
  }

  clear() {
    this.emitter.all.clear();
  }

  emit(event, data?) {
    if (this.emitter) {
      this.emitter.emit.apply(this, [event, data]);
    }
  }
}
