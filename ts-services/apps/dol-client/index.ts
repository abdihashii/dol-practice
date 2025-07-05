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
import {
  loadKeypair,
  getDoLStatePDA,
  getLibraryCardPDA,
  getBookPDA,
  generateBookId,
  getInstructionDiscriminator,
  validateIpfsHash,
  showUsage,
} from "./lib/utils";

async function initializeDoL(
  connection: Connection,
  admin: Keypair
): Promise<void> {
  console.log("🚀 Initializing DoL program...");

  const dolStatePDA = getDoLStatePDA();
  const discriminator = getInstructionDiscriminator("initialize");

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: dolStatePDA, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: discriminator,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      admin,
    ]);

    console.log("✅ DoL program initialized!");
    console.log("📍 DoL State address:", dolStatePDA.toBase58());
    console.log("👤 Admin:", admin.publicKey.toBase58());
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to initialize DoL:", error);
  }
}

async function mintLibraryCard(
  connection: Connection,
  user: Keypair
): Promise<void> {
  console.log("🎫 Minting library card...");

  const libraryCardPDA = getLibraryCardPDA(user.publicKey);
  const discriminator = getInstructionDiscriminator("mint_library_card");

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: libraryCardPDA, isSigner: false, isWritable: true },
      { pubkey: user.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: discriminator,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      user,
    ]);

    console.log("✅ Library card minted!");
    console.log("📍 Library Card address:", libraryCardPDA.toBase58());
    console.log("👤 Owner:", user.publicKey.toBase58());
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to mint library card:", error);
  }
}

async function addBook(
  connection: Connection,
  admin: Keypair,
  title: string,
  author: string,
  ipfsHash: string,
  genre: string
): Promise<void> {
  console.log("📚 Adding book...");

  if (!validateIpfsHash(ipfsHash)) {
    console.error("❌ Invalid IPFS hash format");
    return;
  }

  const bookId = generateBookId();
  const dolStatePDA = getDoLStatePDA();
  const bookPDA = getBookPDA(bookId);
  const discriminator = getInstructionDiscriminator("add_book");

  const titleBytes = Buffer.from(title, "utf8");
  const authorBytes = Buffer.from(author, "utf8");
  const ipfsBytes = Buffer.from(ipfsHash, "utf8");
  const genreBytes = Buffer.from(genre, "utf8");

  const instructionData = Buffer.concat([
    discriminator,
    bookId,
    Buffer.from([titleBytes.length, 0, 0, 0]),
    titleBytes,
    Buffer.from([authorBytes.length, 0, 0, 0]),
    authorBytes,
    Buffer.from([ipfsBytes.length, 0, 0, 0]),
    ipfsBytes,
    Buffer.from([genreBytes.length, 0, 0, 0]),
    genreBytes,
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: dolStatePDA, isSigner: false, isWritable: true },
      { pubkey: bookPDA, isSigner: false, isWritable: true },
      { pubkey: admin.publicKey, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      admin,
    ]);

    console.log("✅ Book added!");
    console.log("📖 Title:", title);
    console.log("✍️  Author:", author);
    console.log(
      "🆔 Book ID:",
      Array.from(bookId.slice(0, 4))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
    console.log("📍 Book address:", bookPDA.toBase58());
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to add book:", error);
  }
}

async function updateBook(
  connection: Connection,
  authority: Keypair,
  bookId: Uint8Array,
  updates: {
    title?: string;
    author?: string;
    ipfsHash?: string;
    genre?: string;
  }
): Promise<void> {
  console.log("📝 Updating book...");

  const dolStatePDA = getDoLStatePDA();
  const bookPDA = getBookPDA(bookId);
  const discriminator = getInstructionDiscriminator("update_book");

  // Serialize optional updates
  const titleBytes = updates.title ? Buffer.from(updates.title, "utf8") : null;
  const authorBytes = updates.author
    ? Buffer.from(updates.author, "utf8")
    : null;
  const ipfsBytes = updates.ipfsHash
    ? Buffer.from(updates.ipfsHash, "utf8")
    : null;
  const genreBytes = updates.genre ? Buffer.from(updates.genre, "utf8") : null;

  // Build instruction data with Option<String> serialization
  let instructionData = Buffer.concat([discriminator]);

  // Serialize Option<String> for title
  if (titleBytes) {
    instructionData = Buffer.concat([
      instructionData,
      Buffer.from([1]), // Some
      Buffer.from([titleBytes.length, 0, 0, 0]), // Length
      titleBytes,
    ]);
  } else {
    instructionData = Buffer.concat([instructionData, Buffer.from([0])]); // None
  }

  // Serialize Option<String> for author
  if (authorBytes) {
    instructionData = Buffer.concat([
      instructionData,
      Buffer.from([1]), // Some
      Buffer.from([authorBytes.length, 0, 0, 0]), // Length
      authorBytes,
    ]);
  } else {
    instructionData = Buffer.concat([instructionData, Buffer.from([0])]); // None
  }

  // Serialize Option<String> for ipfs_hash
  if (ipfsBytes) {
    instructionData = Buffer.concat([
      instructionData,
      Buffer.from([1]), // Some
      Buffer.from([ipfsBytes.length, 0, 0, 0]), // Length
      ipfsBytes,
    ]);
  } else {
    instructionData = Buffer.concat([instructionData, Buffer.from([0])]); // None
  }

  // Serialize Option<String> for genre
  if (genreBytes) {
    instructionData = Buffer.concat([
      instructionData,
      Buffer.from([1]), // Some
      Buffer.from([genreBytes.length, 0, 0, 0]), // Length
      genreBytes,
    ]);
  } else {
    instructionData = Buffer.concat([instructionData, Buffer.from([0])]); // None
  }

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: dolStatePDA, isSigner: false, isWritable: false },
      { pubkey: bookPDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      authority,
    ]);

    console.log("✅ Book updated!");
    console.log("📍 Book address:", bookPDA.toBase58());
    console.log("📝 Updated fields:", Object.keys(updates).join(", "));
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to update book:", error);
  }
}

async function removeBook(
  connection: Connection,
  authority: Keypair,
  bookId: Uint8Array
): Promise<void> {
  console.log("🗑️ Removing book...");

  const dolStatePDA = getDoLStatePDA();
  const bookPDA = getBookPDA(bookId);
  const discriminator = getInstructionDiscriminator("remove_book");

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: dolStatePDA, isSigner: false, isWritable: true },
      { pubkey: bookPDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: discriminator,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      authority,
    ]);

    console.log("✅ Book removed!");
    console.log("📍 Book address:", bookPDA.toBase58());
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to remove book:", error);
  }
}

async function pauseProgram(
  connection: Connection,
  authority: Keypair
): Promise<void> {
  console.log("⏸️ Pausing program...");

  const dolStatePDA = getDoLStatePDA();
  const discriminator = getInstructionDiscriminator("pause_program");

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: dolStatePDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: discriminator,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      authority,
    ]);

    console.log("✅ Program paused!");
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to pause program:", error);
  }
}

async function unpauseProgram(
  connection: Connection,
  authority: Keypair
): Promise<void> {
  console.log("▶️ Unpausing program...");

  const dolStatePDA = getDoLStatePDA();
  const discriminator = getInstructionDiscriminator("unpause_program");

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: dolStatePDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: discriminator,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      authority,
    ]);

    console.log("✅ Program unpaused!");
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to unpause program:", error);
  }
}

async function getBook(
  connection: Connection,
  bookIdHex: string
): Promise<void> {
  console.log("📖 Getting book information...");

  try {
    const bookId = new Uint8Array(16);
    const hex = bookIdHex.replace(/-/g, "");
    for (let i = 0; i < Math.min(16, hex.length / 2); i++) {
      bookId[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    }

    const bookPDA = getBookPDA(bookId);

    // First check if the book exists
    const accountInfo = await connection.getAccountInfo(bookPDA);
    if (!accountInfo) {
      console.log("❌ Book not found");
      return;
    }

    // Call the program's get_book instruction to display detailed information
    const discriminator = getInstructionDiscriminator("get_book");
    const instruction = new TransactionInstruction({
      keys: [{ pubkey: bookPDA, isSigner: false, isWritable: false }],
      programId: PROGRAM_ID,
      data: discriminator,
    });

    const transaction = new Transaction().add(instruction);

    // Send the transaction to trigger the program logs
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      []
    );

    console.log("✅ Book details retrieved!");
    console.log("📍 Book address:", bookPDA.toBase58());
    console.log("🔗 Transaction signature:", signature);
    console.log("📝 Check transaction logs for detailed book information");
  } catch (error) {
    console.error("Failed to get book:", error);
  }
}

async function getLibraryCard(
  connection: Connection,
  ownerAddress: string
): Promise<void> {
  console.log("🎫 Getting library card information...");

  try {
    const ownerPubkey = new PublicKey(ownerAddress);
    const libraryCardPDA = getLibraryCardPDA(ownerPubkey);

    // Check if the library card exists and get account data
    const accountInfo = await connection.getAccountInfo(libraryCardPDA);
    if (!accountInfo) {
      console.log("❌ No library card found for this wallet");
      console.log("💡 Use 'mint-card' command to create a library card");
      return;
    }

    // Parse the library card data
    // Library card structure: [discriminator(8)] + [owner(32)] + [card_id(16)] + [mint_timestamp(8)] + [bump(1)] + [reserved(32)]
    const data = accountInfo.data;

    // Skip discriminator (first 8 bytes)
    const ownerBytes = data.slice(8, 40);
    const cardIdBytes = data.slice(40, 56); // Updated: UUID is 16 bytes
    const mintTimestampBytes = data.slice(56, 64); // Updated: shifted by 8 bytes

    // Parse the data
    const cardOwner = new PublicKey(ownerBytes);
    const cardUuid = cardIdBytes; // UUID as raw bytes
    const mintTimestamp = new DataView(
      mintTimestampBytes.buffer,
      mintTimestampBytes.byteOffset
    ).getBigInt64(0, true);

    // Convert timestamp to readable date
    const mintDate = new Date(Number(mintTimestamp) * 1000);

    // Format UUID for display
    const uuidHex = Array.from(cardUuid)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const formattedUuid = `${uuidHex.slice(0, 8)}-${uuidHex.slice(8, 12)}-${uuidHex.slice(12, 16)}-${uuidHex.slice(16, 20)}-${uuidHex.slice(20, 32)}`;

    console.log("✅ Library card found!");
    console.log("📍 Library Card address:", libraryCardPDA.toBase58());
    console.log("👤 Card holder:", cardOwner.toBase58());
    console.log("🆔 Card UUID:", formattedUuid);
    console.log("📅 Minted on:", mintDate.toISOString());
    console.log("💾 Account size:", accountInfo.data.length, "bytes");
    console.log("🏠 Owner program:", accountInfo.owner.toBase58());
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("Invalid public key")
    ) {
      console.error("❌ Invalid wallet address format");
    } else {
      console.error("Failed to get library card:", error);
    }
  }
}

async function addAdmin(
  connection: Connection,
  authority: Keypair,
  newAdminPubkey: PublicKey
): Promise<void> {
  console.log("👨‍💼 Adding new admin...");

  const dolStatePDA = getDoLStatePDA();
  const discriminator = getInstructionDiscriminator("add_admin");

  const instructionData = Buffer.concat([
    discriminator,
    newAdminPubkey.toBuffer(),
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: dolStatePDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      authority,
    ]);

    console.log("✅ Admin added!");
    console.log("👤 New Admin:", newAdminPubkey.toBase58());
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to add admin:", error);
  }
}

async function removeAdmin(
  connection: Connection,
  authority: Keypair,
  adminToRemove: PublicKey
): Promise<void> {
  console.log("🗑️ Removing admin...");

  const dolStatePDA = getDoLStatePDA();
  const discriminator = getInstructionDiscriminator("remove_admin");

  const instructionData = Buffer.concat([
    discriminator,
    adminToRemove.toBuffer(),
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: dolStatePDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      authority,
    ]);

    console.log("✅ Admin removed!");
    console.log("👤 Removed Admin:", adminToRemove.toBase58());
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to remove admin:", error);
  }
}

async function addCurator(
  connection: Connection,
  authority: Keypair,
  newCuratorPubkey: PublicKey
): Promise<void> {
  console.log("📚 Adding new curator...");

  const dolStatePDA = getDoLStatePDA();
  const discriminator = getInstructionDiscriminator("add_curator");

  const instructionData = Buffer.concat([
    discriminator,
    newCuratorPubkey.toBuffer(),
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: dolStatePDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      authority,
    ]);

    console.log("✅ Curator added!");
    console.log("👤 New Curator:", newCuratorPubkey.toBase58());
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to add curator:", error);
  }
}

async function removeCurator(
  connection: Connection,
  authority: Keypair,
  curatorToRemove: PublicKey
): Promise<void> {
  console.log("🗑️ Removing curator...");

  const dolStatePDA = getDoLStatePDA();
  const discriminator = getInstructionDiscriminator("remove_curator");

  const instructionData = Buffer.concat([
    discriminator,
    curatorToRemove.toBuffer(),
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: dolStatePDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      authority,
    ]);

    console.log("✅ Curator removed!");
    console.log("👤 Removed Curator:", curatorToRemove.toBase58());
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to remove curator:", error);
  }
}

async function transferSuperAdmin(
  connection: Connection,
  authority: Keypair,
  newSuperAdmin: PublicKey
): Promise<void> {
  console.log("👑 Transferring super admin role...");

  const dolStatePDA = getDoLStatePDA();
  const discriminator = getInstructionDiscriminator("transfer_super_admin");

  const instructionData = Buffer.concat([
    discriminator,
    newSuperAdmin.toBuffer(),
  ]);

  const instruction = new TransactionInstruction({
    keys: [
      { pubkey: dolStatePDA, isSigner: false, isWritable: true },
      { pubkey: authority.publicKey, isSigner: true, isWritable: true },
    ],
    programId: PROGRAM_ID,
    data: instructionData,
  });

  const transaction = new Transaction().add(instruction);

  try {
    const signature = await sendAndConfirmTransaction(connection, transaction, [
      authority,
    ]);

    console.log("✅ Super admin role transferred!");
    console.log("👤 New Super Admin:", newSuperAdmin.toBase58());
    console.log("🔗 Transaction signature:", signature);
  } catch (error) {
    console.error("Failed to transfer super admin:", error);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  if (command === "get-book") {
    const bookId = args[1];
    if (!bookId) {
      console.error("Please provide book ID: pnpm start get-book <book_id>");
      return;
    }
    await getBook(connection, bookId);
    return;
  }

  if (command === "get-library-card") {
    const ownerAddress = args[1];
    if (!ownerAddress) {
      console.error(
        "Please provide wallet address: pnpm start get-library-card <wallet_address>"
      );
      return;
    }
    await getLibraryCard(connection, ownerAddress);
    return;
  }

  const keypairIndex = args.indexOf("--keypair");
  if (keypairIndex === -1 || !args[keypairIndex + 1]) {
    showUsage();
    return;
  }

  const keypairPath = args[keypairIndex + 1];

  try {
    const payer = await loadKeypair(keypairPath);
    console.log("🔑 Using wallet:", payer.publicKey.toBase58());

    switch (command) {
      case "initialize":
        await initializeDoL(connection, payer);
        break;

      case "mint-card":
        await mintLibraryCard(connection, payer);
        break;

      case "add-book":
        const titleIndex = args.indexOf("--title");
        const authorIndex = args.indexOf("--author");
        const ipfsIndex = args.indexOf("--ipfs");
        const genreIndex = args.indexOf("--genre");

        if (
          titleIndex === -1 ||
          authorIndex === -1 ||
          ipfsIndex === -1 ||
          genreIndex === -1 ||
          !args[titleIndex + 1] ||
          !args[authorIndex + 1] ||
          !args[ipfsIndex + 1] ||
          !args[genreIndex + 1]
        ) {
          console.error("Missing required arguments for add-book");
          showUsage();
          return;
        }

        await addBook(
          connection,
          payer,
          args[titleIndex + 1],
          args[authorIndex + 1],
          args[ipfsIndex + 1],
          args[genreIndex + 1]
        );
        break;

      case "add-admin":
        const adminIndex = args.indexOf("--admin");
        if (adminIndex === -1 || !args[adminIndex + 1]) {
          console.error("Missing --admin argument");
          showUsage();
          return;
        }
        try {
          const newAdminPubkey = new PublicKey(args[adminIndex + 1]);
          await addAdmin(connection, payer, newAdminPubkey);
        } catch {
          console.error("Invalid admin public key format");
        }
        break;

      case "remove-admin":
        const removeAdminIndex = args.indexOf("--admin");
        if (removeAdminIndex === -1 || !args[removeAdminIndex + 1]) {
          console.error("Missing --admin argument");
          showUsage();
          return;
        }
        try {
          const adminToRemove = new PublicKey(args[removeAdminIndex + 1]);
          await removeAdmin(connection, payer, adminToRemove);
        } catch {
          console.error("Invalid admin public key format");
        }
        break;

      case "add-curator":
        const curatorIndex = args.indexOf("--curator");
        if (curatorIndex === -1 || !args[curatorIndex + 1]) {
          console.error("Missing --curator argument");
          showUsage();
          return;
        }
        try {
          const newCuratorPubkey = new PublicKey(args[curatorIndex + 1]);
          await addCurator(connection, payer, newCuratorPubkey);
        } catch {
          console.error("Invalid curator public key format");
        }
        break;

      case "remove-curator":
        const removeCuratorIndex = args.indexOf("--curator");
        if (removeCuratorIndex === -1 || !args[removeCuratorIndex + 1]) {
          console.error("Missing --curator argument");
          showUsage();
          return;
        }
        try {
          const curatorToRemove = new PublicKey(args[removeCuratorIndex + 1]);
          await removeCurator(connection, payer, curatorToRemove);
        } catch {
          console.error("Invalid curator public key format");
        }
        break;

      case "transfer-super-admin":
        const newSuperAdminIndex = args.indexOf("--new-super-admin");
        if (newSuperAdminIndex === -1 || !args[newSuperAdminIndex + 1]) {
          console.error("Missing --new-super-admin argument");
          showUsage();
          return;
        }
        try {
          const newSuperAdminPubkey = new PublicKey(
            args[newSuperAdminIndex + 1]
          );
          await transferSuperAdmin(connection, payer, newSuperAdminPubkey);
        } catch {
          console.error("Invalid super admin public key format");
        }
        break;

      case "update-book":
        const updateBookIdIndex = args.indexOf("--book-id");
        if (updateBookIdIndex === -1 || !args[updateBookIdIndex + 1]) {
          console.error("Missing --book-id argument");
          showUsage();
          return;
        }

        const bookIdHex = args[updateBookIdIndex + 1];
        const updates: any = {};

        const updateTitleIndex = args.indexOf("--title");
        if (updateTitleIndex !== -1 && args[updateTitleIndex + 1]) {
          updates.title = args[updateTitleIndex + 1];
        }

        const updateAuthorIndex = args.indexOf("--author");
        if (updateAuthorIndex !== -1 && args[updateAuthorIndex + 1]) {
          updates.author = args[updateAuthorIndex + 1];
        }

        const updateIpfsIndex = args.indexOf("--ipfs");
        if (updateIpfsIndex !== -1 && args[updateIpfsIndex + 1]) {
          updates.ipfsHash = args[updateIpfsIndex + 1];
        }

        const updateGenreIndex = args.indexOf("--genre");
        if (updateGenreIndex !== -1 && args[updateGenreIndex + 1]) {
          updates.genre = args[updateGenreIndex + 1];
        }

        if (Object.keys(updates).length === 0) {
          console.error(
            "No fields to update. Provide at least one: --title, --author, --ipfs, or --genre"
          );
          showUsage();
          return;
        }

        try {
          const bookId = new Uint8Array(16);
          const hex = bookIdHex.replace(/-/g, "");
          for (let i = 0; i < Math.min(16, hex.length / 2); i++) {
            bookId[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
          }
          await updateBook(connection, payer, bookId, updates);
        } catch {
          console.error("Invalid book ID format");
        }
        break;

      case "remove-book":
        const removeBookIdIndex = args.indexOf("--book-id");
        if (removeBookIdIndex === -1 || !args[removeBookIdIndex + 1]) {
          console.error("Missing --book-id argument");
          showUsage();
          return;
        }

        try {
          const removeBookIdHex = args[removeBookIdIndex + 1];
          const removeBookId = new Uint8Array(16);
          const removeHex = removeBookIdHex.replace(/-/g, "");
          for (let i = 0; i < Math.min(16, removeHex.length / 2); i++) {
            removeBookId[i] = parseInt(
              removeHex.substring(i * 2, i * 2 + 2),
              16
            );
          }
          await removeBook(connection, payer, removeBookId);
        } catch {
          console.error("Invalid book ID format");
        }
        break;

      case "pause-program":
        await pauseProgram(connection, payer);
        break;

      case "unpause-program":
        await unpauseProgram(connection, payer);
        break;

      default:
        showUsage();
    }
  } catch (error) {
    console.error("Failed to load keypair:", error);
  }
}

main().catch(console.error);
