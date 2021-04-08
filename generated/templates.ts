// THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.

import {
  Address,
  DataSourceTemplate,
  DataSourceContext
} from "@graphprotocol/graph-ts";

export class SigmaIndexPoolV1 extends DataSourceTemplate {
  static create(address: Address): void {
    DataSourceTemplate.create("SigmaIndexPoolV1", [address.toHex()]);
  }

  static createWithContext(address: Address, context: DataSourceContext): void {
    DataSourceTemplate.createWithContext(
      "SigmaIndexPoolV1",
      [address.toHex()],
      context
    );
  }
}
