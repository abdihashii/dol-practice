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
 *    - Current super admin address
 *    - Current book count
 *    - Program version
 *    - Number of admins and curators
 *    - Whether the program is paused
 *    - Rate limiting status (books added today, daily limits)
 * 3. If not initialized, provides instructions on how to initialize
 *
 * This is useful for:
 * - Verifying program deployment status
 * - Checking current program state before running tests
 * - Debugging initialization issues
 * - Quick health checks of the deployed program
 * - Monitoring rate limiting status
 *
 * Note: This is a read-only operation that doesn't require any special permissions.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DolProgram } from "../target/types/dol_program";
import { PublicKey } from "@solana/web3.js";

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
    console.log("📍 Current super admin:", dolState.superAdmin.toString());
    console.log("📚 Book count:", dolState.bookCount.toString());
    console.log("🔢 Version:", dolState.version);
    console.log("👥 Admins:", dolState.admins.length);
    console.log("👥 Curators:", dolState.curators.length);

    // Check if program is paused
    const isPaused = (dolState.flags & 1) !== 0;
    console.log("⏸️  Program paused:", isPaused);

    // Display rate limiting status
    console.log("⏰ Rate limiting status:");
    console.log("   📖 Books added today:", dolState.booksAddedToday);
    console.log("   📅 Last addition day:", dolState.lastBookAdditionDay);
    console.log("   ⏳ Last addition time:", dolState.lastBookAddition);

    // Security features status
    if (dolState.pendingSuperAdmin) {
      console.log(
        "🔄 Pending super admin transfer to:",
        dolState.pendingSuperAdmin.toString()
      );
      console.log("   ⏰ Transfer initiated at:", dolState.transferInitiatedAt);
    }

    if (dolState.emergencyRecoveryNewAdmin) {
      console.log(
        "🚨 Emergency recovery in progress for:",
        dolState.emergencyRecoveryNewAdmin.toString()
      );
      console.log(
        "   🗳️  Recovery votes:",
        dolState.emergencyRecoveryVotes.length
      );
    }

    return;
  } catch (err) {
    console.log("❌ DoL state not initialized");
    console.log("\nTo initialize DoL state:");
    console.log(
      "1. Any wallet can now initialize as super admin (multi-sig ready!)"
    );
    console.log("2. For production: Use a multi-signature wallet address");
    console.log("3. For development: Use any test wallet");
    console.log("4. Run: anchor run init-dol");
    console.log(
      "\n💡 Security Note: The initializing wallet becomes the super admin"
    );
    console.log(
      "   Consider using a multi-sig wallet for production deployments"
    );
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
