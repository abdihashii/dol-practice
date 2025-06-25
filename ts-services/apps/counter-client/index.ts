import {
  clusterApiUrl,
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import { createCounterInstruction } from "./lib/instructions";
import type { CommandArgs } from "./lib/types";
import {
  deserializeCounter,
  getCounterPDA,
  loadKeypair,
  parseCounterAddress,
  showCommands,
  showUsage,
} from "./lib/utils";

/**
 * Initializes a new counter account for the given payer.
 * Automatically derives the counter PDA from the payer's public key and creates the account
 * with the payer as the authority. Logs the counter address and transaction signature on success.
 * 
 * @param connection - Solana RPC connection
 * @param payer - Keypair that will pay for the transaction and become the counter authority
 */
async function initializeCounter(
  connection: Connection,
  payer: Keypair
): Promise<void> {
  console.log("🚀 Initializing counter...");

  const counterPDA = getCounterPDA(payer.publicKey);

  const instruction = createCounterInstruction(
    "initialize",
    counterPDA,
    payer.publicKey
  );

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

/**
 * Increments the count value of a counter account by 1.
 * Only the authority (owner) of the counter can perform this operation.
 * Logs success message and transaction signature on completion, or error on failure.
 * 
 * @param connection - Solana RPC connection
 * @param payer - Keypair of the counter authority (must be the counter owner)
 * @param counterAddress - Public key of the counter account to increment
 */
async function incrementCounter(
  connection: Connection,
  payer: Keypair,
  counterAddress: PublicKey
): Promise<void> {
  console.log("⬆️ Incrementing counter...");

  const instruction = createCounterInstruction(
    "increment",
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

/**
 * Decrements the count value of a counter account by 1.
 * Only the authority (owner) of the counter can perform this operation.
 * Logs success message and transaction signature on completion, or error on failure.
 * 
 * @param connection - Solana RPC connection
 * @param payer - Keypair of the counter authority (must be the counter owner)
 * @param counterAddress - Public key of the counter account to decrement
 */
async function decrementCounter(
  connection: Connection,
  payer: Keypair,
  counterAddress: PublicKey
): Promise<void> {
  console.log("⬇️ Decrementing counter...");

  const instruction = createCounterInstruction(
    "decrement",
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

/**
 * Retrieves and displays the current state of a counter account.
 * This is a read-only operation that anyone can perform. Displays the counter address,
 * authority, and current count value. Shows "Counter not found" message if account doesn't exist.
 * 
 * @param connection - Solana RPC connection
 * @param counterAddress - Public key of the counter account to read
 */
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

/**
 * Handles the execution of CLI commands by routing to appropriate handler functions.
 * Supports initialize, increment, decrement, get, and my-counter commands.
 * For increment/decrement, automatically derives the payer's counter PDA.
 * 
 * @param command - The command string to execute ("initialize" | "increment" | "decrement" | "get" | "my-counter")
 * @param args - Command line arguments array (used for parsing counter address in 'get' command)
 * @param connection - Solana RPC connection
 * @param payer - Keypair for signing transactions and PDA derivation
 */
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

main().catch(console.error);
