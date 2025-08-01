import type { Hook } from "@civic/hook-common";

export class HookChain {
  private _hooks: Hook[];

  constructor(hooks: Hook[]) {
    this._hooks = hooks;
  }
}
