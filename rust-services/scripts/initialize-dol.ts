/**
 * DoL Program Initialization Script
 *
 * Purpose: Initializes the Decentralized Open Library (DoL) program's global state account.
 *
 * Requirements:
 * - Must be run with the super admin wallet (AfuXGptXuHDGpnAL5V27fUkNkHTVcDPGgF1cGbmTena)
 * - The wallet configured in Anchor.toml must match the hardcoded super admin key
 * - Can only be run once per program deployment
 *
 * Usage: anchor run init-dol
 *
 * What it does:
 * 1. Checks if DoL state is already initialized
 * 2. If not, initializes the global state with the super admin
 * 3. Sets up initial configuration (version, flags, empty admin/curator lists)
 *
 * Note: This is an admin operation required before any other program functions can be used.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DolProgram } from "../target/types/dol_program";
import { PublicKey } from "@solana/web3.js";

const SUPER_ADMIN_KEY = new PublicKey(
  "AfuXGptXuHDGpnAL5V27fUkNkHTVcDPGgF1cGbmTena"
);

async function main() {
  // Configure provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.DolProgram as Program<DolProgram>;

  // Get the wallet from the provider (uses wallet configured in Anchor.toml)
  const wallet = provider.wallet as anchor.Wallet;
  const walletPublicKey = wallet.publicKey;

  console.log("Current wallet public key:", walletPublicKey.toString());
  console.log("Expected super admin:", SUPER_ADMIN_KEY.toString());

  // Find the DoL state PDA
  const [dolStatePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("dol_state")],
    program.programId
  );

  // Check if already initialized
  try {
    const dolState = await program.account.doLState.fetch(dolStatePda);
    console.log("DoL state already initialized!");
    console.log("Super admin:", dolState.superAdmin.toString());
    console.log("Book count:", dolState.bookCount.toString());
    console.log("Version:", dolState.version);
    console.log(
      "Admins:",
      dolState.admins.map((a: PublicKey) => a.toString())
    );
    console.log(
      "Curators:",
      dolState.curators.map((c: PublicKey) => c.toString())
    );
    return;
  } catch (err) {
    console.log("DoL state not initialized, proceeding with initialization...");
  }

  // Verify the wallet matches the expected super admin
  if (walletPublicKey.toString() !== SUPER_ADMIN_KEY.toString()) {
    console.log(
      "\n❌ ERROR: Current wallet doesn't match the required super admin key!"
    );
    console.log("Current wallet:", walletPublicKey.toString());
    console.log("Required super admin:", SUPER_ADMIN_KEY.toString());
    console.log("\nTo initialize the DoL program:");
    console.log(
      "1. Use the wallet with public key:",
      SUPER_ADMIN_KEY.toString()
    );
    console.log(
      "2. Update the 'wallet' path in Anchor.toml to point to the correct keypair"
    );
    console.log(
      "3. Or deploy a test version with a different super admin for development"
    );
    process.exit(1);
  }

  try {
    // Initialize the DoL state
    const tx = await program.methods
      .initialize()
      .accounts({
        dolState: dolStatePda,
        superAdmin: walletPublicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .rpc();

    console.log("DoL state initialized successfully!");
    console.log("Transaction signature:", tx);

    // Fetch and display the initialized state
    const dolState = await program.account.doLState.fetch(dolStatePda);
    console.log("\nInitialized state:");
    console.log("Super admin:", dolState.superAdmin.toString());
    console.log("Book count:", dolState.bookCount.toString());
    console.log("Version:", dolState.version);
  } catch (err) {
    console.error("Failed to initialize:", err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
