import { Keypair, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";
import * as fs from "fs";
import { PROGRAM_ID } from "./constants";
import type { CommandArgs, CounterData } from "./types";

export async function loadKeypair(keypairPath: string): Promise<Keypair> {
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

export function deserializeCounter(data: Buffer): CounterData {
  if (data.length < 49) {
    throw new Error("Invalid counter data length");
  }

  const authority = new PublicKey(data.subarray(8, 40));
  const count = data.readBigUInt64LE(40);

  return { authority, count };
}

export function getCounterPDA(userPublicKey: PublicKey): PublicKey {
  const [counterPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("counter"), userPublicKey.toBuffer()],
    PROGRAM_ID
  );
  return counterPDA;
}

/**
 * Computes the instruction discriminator for an Anchor program instruction.
 * Anchor discriminators are the first 8 bytes of SHA256("global:<instruction_name>").
 *
 * @param instructionName - The name of the instruction function (e.g., "initialize", "increment")
 * @returns Buffer containing the 8-byte discriminator
 */
export function getInstructionDiscriminator(instructionName: string): Buffer {
  const hash = createHash("sha256")
    .update(`global:${instructionName}`)
    .digest();
  return hash.subarray(0, 8);
}

export function parseCounterAddress(
  args: CommandArgs,
  command: string
): PublicKey | null {
  const addressIndex = args.findIndex(
    (arg) => !arg.startsWith("--") && arg !== command
  );

  if (addressIndex === -1 || !args[addressIndex]) {
    const usage =
      command === "get"
        ? `pnpm start get <counter_address>`
        : `pnpm start ${command} <counter_address> --keypair <path>`;
    console.error(`Please provide counter address: ${usage}`);
    return null;
  }

  try {
    return new PublicKey(args[addressIndex]);
  } catch {
    console.error("Invalid counter address format");
    return null;
  }
}

export function showUsage(): void {
  console.error("Error: --keypair <path> is required for all operations");
  console.log("");
  console.log("Usage:");
  console.log("  pnpm start <command> --keypair <path_to_keypair>");
  console.log("");
  console.log("Available commands:");
  console.log("  initialize --keypair <path> - Create a new counter");
  console.log("  increment --keypair <path> - Increment your counter");
  console.log("  decrement --keypair <path> - Decrement your counter");
  console.log(
    "  get <counter_address> - Get counter value (no keypair needed)"
  );
  console.log("  my-counter --keypair <path> - Get your counter PDA and value");
}

export function showCommands(): void {
  console.log("Available commands:");
  console.log("  initialize --keypair <path> - Create a new counter");
  console.log("  increment --keypair <path> - Increment your counter");
  console.log("  decrement --keypair <path> - Decrement your counter");
  console.log("  get <counter_address> - Get counter value");
  console.log("  my-counter --keypair <path> - Get your counter PDA and value");
}
