/**
 * DoL Program Initialization Script
 *
 * Purpose: Initializes the Decentralized Open Library (DoL) program's global state account.
 *
 * Requirements:
 * - Can be run with ANY wallet (the initializing wallet becomes the super admin)
 * - For production: Use a multi-signature wallet for enhanced security
 * - For development: Any test wallet can be used
 * - Can only be run once per program deployment
 *
 * Usage: anchor run init-dol
 *
 * What it does:
 * 1. Checks if DoL state is already initialized
 * 2. If not, initializes the global state with the current wallet as super admin
 * 3. Sets up initial configuration (version, flags, empty admin/curator lists, rate limiting)
 * 4. Displays the initialized state including new security features
 *
 * Note: This is an admin operation required before any other program functions can be used.
 * The wallet that runs this script becomes the super admin with full control.
 */
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DolProgram } from "../target/types/dol_program";
import { PublicKey } from "@solana/web3.js";

async function main() {
  // Configure provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.DolProgram as Program<DolProgram>;

  // Get the wallet from the provider (uses wallet configured in Anchor.toml)
  const wallet = provider.wallet as anchor.Wallet;
  const walletPublicKey = wallet.publicKey;

  console.log("🔑 Current wallet public key:", walletPublicKey.toString());
  console.log(
    "💡 This wallet will become the super admin if initialization succeeds"
  );
  console.log("🔐 For production, ensure this is a multi-signature wallet!");

  // Find the DoL state PDA
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
    console.log(
      "👥 Admins:",
      dolState.admins.map((a: PublicKey) => a.toString())
    );
    console.log(
      "👨‍🎨 Curators:",
      dolState.curators.map((c: PublicKey) => c.toString())
    );

    // Display security features
    const isPaused = (dolState.flags & 1) !== 0;
    console.log("⏸️  Program paused:", isPaused);
    console.log(
      "⏰ Rate limiting - Books added today:",
      dolState.booksAddedToday
    );

    if (dolState.pendingSuperAdmin) {
      console.log(
        "🔄 Pending super admin transfer to:",
        dolState.pendingSuperAdmin.toString()
      );
    }

    if (dolState.emergencyRecoveryNewAdmin) {
      console.log(
        "🚨 Emergency recovery in progress for:",
        dolState.emergencyRecoveryNewAdmin.toString()
      );
    }

    return;
  } catch (err) {
    console.log(
      "📋 DoL state not initialized, proceeding with initialization..."
    );
  }

  // Confirm initialization with current wallet
  console.log("\n🚀 Proceeding with initialization...");
  console.log("📝 The current wallet will become the super admin:");
  console.log("   Wallet:", walletPublicKey.toString());
  console.log("\n⚠️  Important Security Notes:");
  console.log("   • This wallet will have FULL CONTROL over the DoL program");
  console.log("   • For production: Use a multi-signature wallet");
  console.log("   • For development: Any test wallet is fine");
  console.log(
    "   • Super admin can be transferred later using secure timelock mechanism"
  );

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

    console.log("\n✅ DoL state initialized successfully!");
    console.log("📝 Transaction signature:", tx);

    // Fetch and display the initialized state
    const dolState = await program.account.doLState.fetch(dolStatePda);
    console.log("\n🎉 Initialized state:");
    console.log("📍 Super admin:", dolState.superAdmin.toString());
    console.log("📚 Book count:", dolState.bookCount.toString());
    console.log("🔢 Version:", dolState.version);
    console.log(
      "⏰ Rate limiting initialized - Daily limit: 50 books, Cooldown: 60 seconds"
    );
    console.log("🔐 Security features:");
    console.log("   • Super admin transfer timelock: 7 days");
    console.log("   • Emergency recovery threshold: 2 admin signatures");
    console.log("   • Program pause capability: Available");

    console.log("\n🎯 Next steps:");
    console.log("1. Add admins/curators using the super admin wallet");
    console.log("2. Start adding books to the library");
    console.log("3. Users can mint free library cards to access books");
    console.log(
      "4. Consider transferring super admin to a multi-sig for production"
    );
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
