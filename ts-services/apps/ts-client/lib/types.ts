import { PublicKey } from "@solana/web3.js";

export interface CounterData {
  authority: PublicKey;
  count: bigint;
}

export type CommandArgs = string[];
