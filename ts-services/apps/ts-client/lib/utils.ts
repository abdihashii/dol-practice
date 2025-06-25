import { Keypair, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";
import * as fs from "fs";
import { PROGRAM_ID } from "./constants";
import type { CommandArgs, CounterData } from "./types";

/**
 * Loads a Solana keypair from a JSON file containing the secret key bytes.
 * Reads the file synchronously and expects a JSON array of 64 numbers representing the secret key.
 * 
 * @param keypairPath - Absolute path to the keypair JSON file
 * @returns Promise resolving to the loaded Keypair
 * @throws Error if file doesn't exist, contains invalid JSON, or invalid secret key format
 */
export async function loadKeypair(keypairPath: string): Promise<Keypair> {
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

/**
 * Deserializes counter account data from a buffer into a CounterData object.
 * Expects buffer format: [8 bytes discriminator][32 bytes authority][8 bytes count][1 byte bump].
 * 
 * @param data - Buffer containing the serialized counter account data (minimum 49 bytes)
 * @returns CounterData object with authority (PublicKey) and count (bigint)
 * @throws Error if buffer is less than 49 bytes
 */
export function deserializeCounter(data: Buffer): CounterData {
  if (data.length < 49) {
    throw new Error("Invalid counter data length");
  }

  const authority = new PublicKey(data.subarray(8, 40));
  const count = data.readBigUInt64LE(40);

  return { authority, count };
}

/**
 * Derives the Program Derived Address (PDA) for a user's counter account.
 * Uses the seeds: ["counter", user_public_key] with the counter program ID.
 * Each user has exactly one deterministic counter PDA.
 * 
 * @param userPublicKey - The user's public key used as a seed for PDA derivation
 * @returns The derived counter PDA public key
 */
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

/**
 * Parses a counter address from command line arguments.
 * Finds the first non-flag argument (doesn't start with "--") that isn't the command name itself.
 * Logs appropriate error messages and usage instructions if address is missing or invalid.
 * 
 * @param args - Command line arguments array
 * @param command - The command name to exclude from address parsing
 * @returns PublicKey of the counter address, or null if parsing fails
 */
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

/**
 * Displays complete CLI usage help information to the console.
 * Shows error message about missing keypair, general usage syntax, and all available commands
 * with their descriptions and required parameters.
 */
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

/**
 * Displays a simple list of available CLI commands to the console.
 * Shows just the command names with brief descriptions, without usage syntax or error messages.
 * Used when showing help for unrecognized commands.
 */
export function showCommands(): void {
  console.log("Available commands:");
  console.log("  initialize --keypair <path> - Create a new counter");
  console.log("  increment --keypair <path> - Increment your counter");
  console.log("  decrement --keypair <path> - Decrement your counter");
  console.log("  get <counter_address> - Get counter value");
  console.log("  my-counter --keypair <path> - Get your counter PDA and value");
}
