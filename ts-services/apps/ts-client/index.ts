import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { PROGRAM_ID } from "./lib/constants";
import type { CommandArgs } from "./lib/types";
import {
  deserializeCounter,
  getCounterPDA,
  getInstructionDiscriminator,
  loadKeypair,
  parseCounterAddress,
  showCommands,
  showUsage,
} from "./lib/utils";

// =============================================================================
// Instruction Builders
// =============================================================================

function createInitializeInstruction(
  counter: PublicKey,
  user: PublicKey,
  systemProgram: PublicKey = SystemProgram.programId
): TransactionInstruction {
  const discriminator = getInstructionDiscriminator("initialize");

  return new TransactionInstruction({
    keys: [
      { pubkey: counter, isSigner: false, isWritable: true },
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: systemProgram, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: discriminator,
  });
}

function createIncrementInstruction(
  counter: PublicKey,
  authority: PublicKey
): TransactionInstruction {
  const discriminator = getInstructionDiscriminator("increment");

  return new TransactionInstruction({
    keys: [
      { pubkey: counter, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: discriminator,
  });
}

function createDecrementInstruction(
  counter: PublicKey,
  authority: PublicKey
): TransactionInstruction {
  const discriminator = getInstructionDiscriminator("decrement");

  return new TransactionInstruction({
    keys: [
      { pubkey: counter, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: discriminator,
  });
}

// =============================================================================
// Business Logic Functions
// =============================================================================

async function initializeCounter(
  connection: Connection,
  payer: Keypair
): Promise<void> {
  console.log("🚀 Initializing counter...");

  const counterPDA = getCounterPDA(payer.publicKey);

  const instruction = createInitializeInstruction(counterPDA, payer.publicKey);

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      payer,
    ]);

    console.log("✅ Counter initialized!");
    console.log("📍 Counter address:", counterPDA.toBase58());
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to initialize counter:", error);
  }
}

async function incrementCounter(
  connection: Connection,
  payer: Keypair,
  counterAddress: PublicKey
): Promise<void> {
  console.log("⬆️ Incrementing counter...");

  const instruction = createIncrementInstruction(
    counterAddress,
    payer.publicKey
  );
  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      payer,
    ]);

    console.log("✅ Counter incremented!");
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to increment counter:", error);
  }
}

async function decrementCounter(
  connection: Connection,
  payer: Keypair,
  counterAddress: PublicKey
): Promise<void> {
  console.log("⬇️ Decrementing counter...");

  const instruction = createDecrementInstruction(
    counterAddress,
    payer.publicKey
  );
  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      payer,
    ]);

    console.log("✅ Counter decremented!");
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to decrement counter:", error);
  }
}

async function getCounter(
  connection: Connection,
  counterAddress: PublicKey
): Promise<void> {
  try {
    const accountInfo = await connection.getAccountInfo(counterAddress);

    if (!accountInfo) {
      console.log(
        "❌ Counter not found at address:",
        counterAddress.toBase58()
      );
      return;
    }

    const counterData = deserializeCounter(accountInfo.data);
    console.log("📍 Counter address:", counterAddress.toBase58());
    console.log("👤 Authority:", counterData.authority.toBase58());
    console.log("🔢 Count:", counterData.count.toString());
  } catch (error) {
    console.error("Failed to get counter:", error);
  }
}

// =============================================================================
// Command Handling
// =============================================================================

async function handleCommand(
  command: string,
  args: CommandArgs,
  connection: Connection,
  payer: Keypair
): Promise<void> {
  switch (command) {
    case "initialize":
      await initializeCounter(connection, payer);
      break;

    case "increment":
      const incrementPDA = getCounterPDA(payer.publicKey);
      await incrementCounter(connection, payer, incrementPDA);
      break;

    case "decrement":
      const decrementPDA = getCounterPDA(payer.publicKey);
      await decrementCounter(connection, payer, decrementPDA);
      break;

    case "get":
      const getAddress = parseCounterAddress(args, "get");
      if (!getAddress) return;
      await getCounter(connection, getAddress);
      break;

    case "my-counter":
      const myCounterPDA = getCounterPDA(payer.publicKey);
      console.log("📍 Your counter PDA:", myCounterPDA.toBase58());
      await getCounter(connection, myCounterPDA);
      break;

    default:
      showCommands();
  }
}

// =============================================================================
// Main Function
// =============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // Handle 'get' command separately as it doesn't need a keypair
  if (command === "get") {
    const getAddress = parseCounterAddress(args, "get");
    if (!getAddress) return;
    await getCounter(connection, getAddress);
    return;
  }

  // For other commands, require keypair
  const keypairIndex = args.indexOf("--keypair");
  if (keypairIndex === -1 || !args[keypairIndex + 1]) {
    showUsage();
    return;
  }

  const keypairPath = args[keypairIndex + 1];

  try {
    const payer = await loadKeypair(keypairPath);
    console.log("🔑 Using wallet:", payer.publicKey.toBase58());

    await handleCommand(command, args, connection, payer);
  } catch (error) {
    console.error("Failed to load keypair:", error);
  }
}

// =============================================================================
// Entry Point
// =============================================================================

main().catch(console.error);
