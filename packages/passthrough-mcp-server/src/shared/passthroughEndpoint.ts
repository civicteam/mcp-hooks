import type {
  Notification,
  Request,
  Result,
} from "@modelcontextprotocol/sdk/types.js";

import { PassthroughBaseProtocol } from "../protocol/passthroughBaseProtocol.js";

export class PassthroughEndpoint extends PassthroughBaseProtocol<
  Request,
  Notification,
  Result
> {}
