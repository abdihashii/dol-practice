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
import * as fs from "fs";

// =============================================================================
// Types & Interfaces
// =============================================================================

interface CounterData {
  authority: PublicKey;
  count: bigint;
}

type CommandArgs = string[];

// =============================================================================
// Constants
// =============================================================================

const PROGRAM_ID = new PublicKey(
  "89oT3JtfnGATv6hTyzt3fD3y95JNrmEzDRRMYrJ8X53R"
);

// =============================================================================
// Utility Functions
// =============================================================================

async function loadKeypair(keypairPath: string): Promise<Keypair> {
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

function deserializeCounter(data: Buffer): CounterData {
  if (data.length < 49) {
    throw new Error("Invalid counter data length");
  }

  const authority = new PublicKey(data.subarray(8, 40));
  const count = data.readBigUInt64LE(40);

  return { authority, count };
}

function getCounterPDA(userPublicKey: PublicKey): PublicKey {
  const [counterPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("counter"), userPublicKey.toBuffer()],
    PROGRAM_ID
  );
  return counterPDA;
}

function parseCounterAddress(
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

function showUsage(): void {
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

function showCommands(): void {
  console.log("Available commands:");
  console.log("  initialize --keypair <path> - Create a new counter");
  console.log("  increment --keypair <path> - Increment your counter");
  console.log("  decrement --keypair <path> - Decrement your counter");
  console.log("  get <counter_address> - Get counter value");
  console.log("  my-counter --keypair <path> - Get your counter PDA and value");
}

// =============================================================================
// Instruction Builders
// =============================================================================

function createInitializeInstruction(
  counter: PublicKey,
  user: PublicKey,
  systemProgram: PublicKey = SystemProgram.programId
): TransactionInstruction {
  // Instruction discriminator: first 8 bytes of SHA256("global:initialize")
  const discriminator = Buffer.from([175, 175, 109, 31, 13, 152, 155, 237]);

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
  // Instruction discriminator: first 8 bytes of SHA256("global:increment")
  const discriminator = Buffer.from([11, 18, 104, 9, 104, 174, 59, 33]);

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
  // Instruction discriminator: first 8 bytes of SHA256("global:decrement")
  const discriminator = Buffer.from([106, 227, 168, 59, 248, 27, 150, 101]);

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
