#!/usr/bin/env ts-node
/**
 * DoL Program Status Check Script
 *
 * Purpose: Checks if the DoL program's global state is initialized and displays its current status.
 *
 * Usage: anchor run check-dol
 *
 * What it does:
 * 1. Attempts to fetch the DoL state account
 * 2. If initialized, displays:
 *    - Super admin address
 *    - Current book count
 *    - Program version
 *    - Number of admins and curators
 *    - Whether the program is paused
 * 3. If not initialized, provides instructions on how to initialize
 *
 * This is useful for:
 * - Verifying program deployment status
 * - Checking current program state before running tests
 * - Debugging initialization issues
 * - Quick health checks of the deployed program
 *
 * Note: This is a read-only operation that doesn't require any special permissions.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DolProgram } from "../target/types/dol_program";
import { PublicKey } from "@solana/web3.js";

const SUPER_ADMIN_KEY = new PublicKey(
  "AfuXGptXuHDGpnAL5V27fUkNkHTVcDPGgF1cGbmTena"
);

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.DolProgram as Program<DolProgram>;

  const [dolStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("dol_state")],
    program.programId
  );

  // Check if already initialized
  try {
    const dolState = await program.account.doLState.fetch(dolStatePda);
    console.log("✅ DoL state already initialized!");
    console.log("📍 Super admin:", dolState.superAdmin.toString());
    console.log("📚 Book count:", dolState.bookCount.toString());
    console.log("🔢 Version:", dolState.version);
    console.log("👥 Admins:", dolState.admins.length);
    console.log("👥 Curators:", dolState.curators.length);

    // Check if program is paused
    const isPaused = (dolState.flags & 1) !== 0;
    console.log("⏸️  Program paused:", isPaused);

    return;
  } catch (err) {
    console.log("❌ DoL state not initialized");
    console.log("\nTo initialize DoL state for production:");
    console.log(
      "1. You need the wallet with public key:",
      SUPER_ADMIN_KEY.toString()
    );
    console.log("2. Run: anchor run init-dol");
    console.log("\nFor testing purposes, you can:");
    console.log("1. Deploy a test version with a different super admin");
    console.log("2. Or mock the initialization in your tests");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
