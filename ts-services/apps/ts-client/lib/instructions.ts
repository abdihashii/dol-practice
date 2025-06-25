import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { PROGRAM_ID } from "./constants";
import type { InstructionName } from "./types";
import { getInstructionDiscriminator } from "./utils";

/**
 * Creates a counter program instruction for initialize, increment, or decrement operations.
 *
 * @param instructionName - The instruction to create ("initialize", "increment", or "decrement")
 * @param counter - The counter account public key
 * @param authority - The authority/user public key (signer)
 * @param systemProgram - The system program public key (only required for initialize)
 * @returns TransactionInstruction for the specified operation
 */
export function createCounterInstruction(
  instructionName: InstructionName,
  counter: PublicKey,
  authority: PublicKey,
  systemProgram?: PublicKey
): TransactionInstruction {
  const discriminator = getInstructionDiscriminator(instructionName);

  const keys = [
    { pubkey: counter, isSigner: false, isWritable: true },
    {
      pubkey: authority,
      isSigner: true,
      isWritable: instructionName === "initialize",
    },
  ];

  // Initialize instruction needs the system program account
  if (instructionName === "initialize") {
    if (!systemProgram) {
      systemProgram = SystemProgram.programId;
    }
    keys.push({ pubkey: systemProgram, isSigner: false, isWritable: false });
  }

  return new TransactionInstruction({
    keys,
    programId: PROGRAM_ID,
    data: discriminator,
  });
}
