import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DolProgram } from "../target/types/dol_program";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";
import * as fs from "fs";

describe("dol-program", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.DolProgram as Program<DolProgram>;
  const provider = anchor.getProvider();

  let admin: Keypair;
  let user: Keypair;
  let newSuperAdmin: Keypair;
  let maliciousUser: Keypair;
  let dolStatePda: PublicKey;
  let libraryCardPda: PublicKey;
  let bookPda: PublicKey;
  let isInitialized = false;

  // Generate proper UUID v4
  const bookId = Array.from(crypto.getRandomValues(new Uint8Array(16)));
  // Set version bits (version 4)
  bookId[6] = (bookId[6] & 0x0f) | 0x40;
  // Set variant bits
  bookId[8] = (bookId[8] & 0x3f) | 0x80;

  const mockIpfsHash = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

  before(async () => {
    // For testing purposes, we'll create a test keypair
    // Note: In real scenarios, the actual super admin would need the correct secret key
    admin = Keypair.generate();
    user = Keypair.generate();
    newSuperAdmin = Keypair.generate();
    maliciousUser = Keypair.generate();

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        admin.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        user.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        newSuperAdmin.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    );

    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        maliciousUser.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    );

    [dolStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("dol_state")],
      program.programId
    );

    [libraryCardPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("library_card"), user.publicKey.toBuffer()],
      program.programId
    );

    [bookPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("book"), Buffer.from(bookId)],
      program.programId
    );

    // Try to check if DoL state is already initialized
    try {
      const dolState = await program.account.doLState.fetch(dolStatePda);
      isInitialized = true;
      console.log("DoL state already initialized");
      console.log("Current super admin:", dolState.superAdmin.toString());

      // Try to load the current super admin keypair and add our test admin
      try {
        const superAdminKeypair = Keypair.fromSecretKey(
          new Uint8Array(
            JSON.parse(
              fs.readFileSync(
                "/Users/abdirahmanhaji/.config/solana/A1.json",
                "utf-8"
              )
            )
          )
        );

        // Check if loaded keypair matches the current super admin
        if (
          dolState.superAdmin.toString() ===
          superAdminKeypair.publicKey.toString()
        ) {
          // Add our test admin as an admin
          try {
            await program.methods
              .addAdmin(admin.publicKey)
              .accounts({
                dolState: dolStatePda,
                authority: superAdminKeypair.publicKey,
              } as any)
              .signers([superAdminKeypair])
              .rpc();
            console.log("Test admin added to DoL state");
          } catch (err) {
            console.log("Admin may already exist or limit reached:", err);
          }
        } else {
          console.log("Loaded keypair doesn't match current super admin");
        }
      } catch (err) {
        console.log("Could not load super admin keypair:", err);
      }
    } catch (err) {
      console.log(
        "DoL state not initialized - will initialize with test wallet"
      );
      // Try to initialize with our test admin as super admin
      try {
        await program.methods
          .initialize()
          .accounts({
            dolState: dolStatePda,
            superAdmin: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          } as any)
          .signers([admin])
          .rpc();
        isInitialized = true;
        console.log("DoL state initialized with test admin as super admin");
      } catch (initErr) {
        console.log("Could not initialize DoL state:", initErr);
      }
    }
  });

  it("Initializes DoL state with configurable super admin", async () => {
    // This test demonstrates the new configurable initialization flow
    try {
      const dolState = await program.account.doLState.fetch(dolStatePda);
      console.log("✅ DoL state already initialized");
      console.log("📍 Super admin:", dolState.superAdmin.toString());
      console.log("📚 Book count:", dolState.bookCount.toString());
      console.log("🔢 Version:", dolState.version);
      console.log(
        "⏰ Rate limiting - Books added today:",
        dolState.booksAddedToday
      );
      console.log(
        "⏰ Rate limiting - Last addition day:",
        dolState.lastBookAdditionDay
      );
      isInitialized = true;
    } catch (err) {
      console.log("⚠️ DoL state not initialized");
      console.log(
        "ℹ️ Any wallet can now initialize as super admin (multisig-ready design)"
      );
      isInitialized = false;
    }
  });

  it("Mints library card for user", async () => {
    await program.methods
      .mintLibraryCard()
      .accounts({
        libraryCard: libraryCardPda,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([user])
      .rpc();

    const libraryCard = await program.account.libraryCard.fetch(libraryCardPda);

    expect(libraryCard.owner.toString()).to.equal(user.publicKey.toString());
    expect(libraryCard.mintTimestamp.toString()).to.not.be.empty;

    console.log("Library card minted for:", libraryCard.owner.toString());
  });

  it("Admin adds book to catalog", async function () {
    if (!isInitialized) {
      this.skip();
      return;
    }

    const title = "The Great Gatsby";
    const author = "F. Scott Fitzgerald";
    const genre = "Classic";

    await program.methods
      .addBook(bookId, title, author, mockIpfsHash, genre)
      .accounts({
        dolState: dolStatePda,
        book: bookPda,
        authority: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();

    const book = await program.account.book.fetch(bookPda);
    const dolState = await program.account.doLState.fetch(dolStatePda);

    expect(Buffer.from(book.id)).to.deep.equal(Buffer.from(bookId));
    expect(book.title).to.equal(title);
    expect(book.author).to.equal(author);
    expect(book.ipfsHash).to.equal(mockIpfsHash);
    expect(book.genre).to.equal(genre);
    expect(dolState.bookCount.toString()).to.equal("1");

    console.log("Book added:", book.title, "by", book.author);
  });

  it("Retrieves book information", async function () {
    if (!isInitialized) {
      this.skip();
      return;
    }

    await program.methods
      .getBook()
      .accounts({
        book: bookPda,
      })
      .rpc();

    console.log("Book information retrieved successfully");
  });

  it("Verifies library card access", async () => {
    await program.methods
      .verifyAccess()
      .accounts({
        libraryCard: libraryCardPda,
      })
      .rpc();

    console.log("Library card access verified");
  });

  it("Fails to add book with invalid UUID (all zeros)", async function () {
    if (!isInitialized) {
      this.skip();
      return;
    }

    const invalidId = new Array(16).fill(0);

    try {
      await program.methods
        .addBook(invalidId, "Test Book", "Test Author", mockIpfsHash, "Fiction")
        .accounts({
          dolState: dolStatePda,
          book: PublicKey.findProgramAddressSync(
            [Buffer.from("book"), Buffer.from(invalidId)],
            program.programId
          )[0],
          authority: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([admin])
        .rpc();

      expect.fail("Should have failed with invalid book ID");
    } catch (error: any) {
      expect(error.toString()).to.include("InvalidBookId");
    }
  });

  it("Fails to add book with invalid UUID v4 format", async function () {
    if (!isInitialized) {
      this.skip();
      return;
    }

    // Create invalid UUID with wrong version bits
    const invalidId = Array.from(crypto.getRandomValues(new Uint8Array(16)));
    invalidId[6] = 0x30; // Set version to 3 instead of 4

    try {
      await program.methods
        .addBook(invalidId, "Test Book", "Test Author", mockIpfsHash, "Fiction")
        .accounts({
          dolState: dolStatePda,
          book: PublicKey.findProgramAddressSync(
            [Buffer.from("book"), Buffer.from(invalidId)],
            program.programId
          )[0],
          authority: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([admin])
        .rpc();

      expect.fail("Should have failed with invalid UUID v4");
    } catch (error: any) {
      expect(error.toString()).to.include("InvalidBookId");
    }
  });

  it("Fails to add book with invalid IPFS hash", async function () {
    if (!isInitialized) {
      this.skip();
      return;
    }

    const newBookId = Array.from(crypto.getRandomValues(new Uint8Array(16)));
    // Set proper UUID v4 format
    newBookId[6] = (newBookId[6] & 0x0f) | 0x40;
    newBookId[8] = (newBookId[8] & 0x3f) | 0x80;
    const invalidIpfsHash = "invalid_hash";

    try {
      await program.methods
        .addBook(
          newBookId,
          "Test Book",
          "Test Author",
          invalidIpfsHash,
          "Fiction"
        )
        .accounts({
          dolState: dolStatePda,
          book: PublicKey.findProgramAddressSync(
            [Buffer.from("book"), Buffer.from(newBookId)],
            program.programId
          )[0],
          authority: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([admin])
        .rpc();

      expect.fail("Should have failed with invalid IPFS hash");
    } catch (error: any) {
      expect(error.toString()).to.include("InvalidIpfsHash");
    }
  });

  it("Fails to add book with empty title", async function () {
    if (!isInitialized) {
      this.skip();
      return;
    }

    const newBookId = Array.from(crypto.getRandomValues(new Uint8Array(16)));
    // Set proper UUID v4 format
    newBookId[6] = (newBookId[6] & 0x0f) | 0x40;
    newBookId[8] = (newBookId[8] & 0x3f) | 0x80;

    try {
      await program.methods
        .addBook(newBookId, "", "Test Author", mockIpfsHash, "Fiction")
        .accounts({
          dolState: dolStatePda,
          book: PublicKey.findProgramAddressSync(
            [Buffer.from("book"), Buffer.from(newBookId)],
            program.programId
          )[0],
          authority: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([admin])
        .rpc();

      expect.fail("Should have failed with empty title");
    } catch (error: any) {
      expect(error.toString()).to.include("TitleTooLong");
    }
  });

  it("Fails when non-admin tries to add book", async function () {
    if (!isInitialized) {
      this.skip();
      return;
    }

    const newBookId = Array.from(crypto.getRandomValues(new Uint8Array(16)));
    // Set proper UUID v4 format
    newBookId[6] = (newBookId[6] & 0x0f) | 0x40;
    newBookId[8] = (newBookId[8] & 0x3f) | 0x80;

    try {
      await program.methods
        .addBook(
          newBookId,
          "Unauthorized Book",
          "Test Author",
          mockIpfsHash,
          "Fiction"
        )
        .accounts({
          dolState: dolStatePda,
          book: PublicKey.findProgramAddressSync(
            [Buffer.from("book"), Buffer.from(newBookId)],
            program.programId
          )[0],
          authority: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([user])
        .rpc();

      expect.fail("Should have failed with unauthorized access");
    } catch (error: any) {
      // The error could be InsufficientPermissions since we're checking permissions
      expect(error.toString()).to.match(
        /InsufficientPermissions|ConstraintHasOne|unknown signer/
      );
    }
  });

  it("Fails to mint duplicate library card", async () => {
    try {
      await program.methods
        .mintLibraryCard()
        .accounts({
          libraryCard: libraryCardPda,
          user: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([user])
        .rpc();

      expect.fail("Should have failed with duplicate library card");
    } catch (error: any) {
      expect(error.toString()).to.include("already in use");
    }
  });

  // =============================================
  // RATE LIMITING SECURITY TESTS
  // =============================================

  describe("Rate Limiting Security Tests", () => {
    it("Enforces cooldown period between book additions", async function () {
      if (!isInitialized) {
        this.skip();
        return;
      }

      const bookId1 = Array.from(crypto.getRandomValues(new Uint8Array(16)));
      bookId1[6] = (bookId1[6] & 0x0f) | 0x40;
      bookId1[8] = (bookId1[8] & 0x3f) | 0x80;

      const bookId2 = Array.from(crypto.getRandomValues(new Uint8Array(16)));
      bookId2[6] = (bookId2[6] & 0x0f) | 0x40;
      bookId2[8] = (bookId2[8] & 0x3f) | 0x80;

      // Add first book
      await program.methods
        .addBook(bookId1, "Book 1", "Author 1", mockIpfsHash, "Fiction")
        .accounts({
          dolState: dolStatePda,
          book: PublicKey.findProgramAddressSync(
            [Buffer.from("book"), Buffer.from(bookId1)],
            program.programId
          )[0],
          authority: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([admin])
        .rpc();

      // Try to add second book immediately (should fail due to cooldown)
      try {
        await program.methods
          .addBook(bookId2, "Book 2", "Author 2", mockIpfsHash, "Fiction")
          .accounts({
            dolState: dolStatePda,
            book: PublicKey.findProgramAddressSync(
              [Buffer.from("book"), Buffer.from(bookId2)],
              program.programId
            )[0],
            authority: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          } as any)
          .signers([admin])
          .rpc();

        expect.fail("Should have failed due to rate limit");
      } catch (error: any) {
        expect(error.toString()).to.include("RateLimitExceeded");
        console.log("✅ Cooldown period enforced correctly");
      }
    });

    it("Tracks daily book addition limits", async function () {
      if (!isInitialized) {
        this.skip();
        return;
      }

      const dolState = await program.account.doLState.fetch(dolStatePda);
      console.log("Current books added today:", dolState.booksAddedToday);
      console.log("Daily limit:", 50); // MAX_BOOKS_PER_DAY constant

      // Verify the counter is working
      expect(dolState.booksAddedToday).to.be.greaterThan(0);
      expect(dolState.lastBookAdditionDay).to.be.greaterThan(0);

      console.log("✅ Daily tracking working correctly");
    });
  });

  // =============================================
  // IMPROVED IPFS VALIDATION TESTS
  // =============================================

  describe("IPFS Validation Security Tests", () => {
    it("Accepts valid CIDv0 (Qm) hash", async function () {
      if (!isInitialized) {
        this.skip();
        return;
      }

      const bookId = Array.from(crypto.getRandomValues(new Uint8Array(16)));
      bookId[6] = (bookId[6] & 0x0f) | 0x40;
      bookId[8] = (bookId[8] & 0x3f) | 0x80;

      const validCidV0 = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

      // Wait for cooldown period
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await program.methods
        .addBook(bookId, "CIDv0 Test", "Test Author", validCidV0, "Tech")
        .accounts({
          dolState: dolStatePda,
          book: PublicKey.findProgramAddressSync(
            [Buffer.from("book"), Buffer.from(bookId)],
            program.programId
          )[0],
          authority: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([admin])
        .rpc();

      console.log("✅ Valid CIDv0 hash accepted");
    });

    it("Accepts valid CIDv1 (baf) hash with proper base32", async function () {
      if (!isInitialized) {
        this.skip();
        return;
      }

      const bookId = Array.from(crypto.getRandomValues(new Uint8Array(16)));
      bookId[6] = (bookId[6] & 0x0f) | 0x40;
      bookId[8] = (bookId[8] & 0x3f) | 0x80;

      const validCidV1 =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi";

      // Wait for cooldown period
      await new Promise((resolve) => setTimeout(resolve, 1000));

      await program.methods
        .addBook(bookId, "CIDv1 Test", "Test Author", validCidV1, "Tech")
        .accounts({
          dolState: dolStatePda,
          book: PublicKey.findProgramAddressSync(
            [Buffer.from("book"), Buffer.from(bookId)],
            program.programId
          )[0],
          authority: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        } as any)
        .signers([admin])
        .rpc();

      console.log("✅ Valid CIDv1 hash accepted");
    });

    it("Rejects CIDv1 with invalid base32 characters", async function () {
      if (!isInitialized) {
        this.skip();
        return;
      }

      const bookId = Array.from(crypto.getRandomValues(new Uint8Array(16)));
      bookId[6] = (bookId[6] & 0x0f) | 0x40;
      bookId[8] = (bookId[8] & 0x3f) | 0x80;

      // Invalid CIDv1 with uppercase and invalid characters (8, 9)
      const invalidCidV1 =
        "bafybeigdyrzt5sfp7udm7hu76uh7y26NF3efuylqabf3oclgtqy89fbzdi";

      try {
        await program.methods
          .addBook(bookId, "Invalid CIDv1", "Test Author", invalidCidV1, "Tech")
          .accounts({
            dolState: dolStatePda,
            book: PublicKey.findProgramAddressSync(
              [Buffer.from("book"), Buffer.from(bookId)],
              program.programId
            )[0],
            authority: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          } as any)
          .signers([admin])
          .rpc();

        expect.fail("Should have failed with invalid base32 characters");
      } catch (error: any) {
        expect(error.toString()).to.include("InvalidIpfsHash");
        console.log("✅ Invalid base32 characters rejected correctly");
      }
    });
  });

  // =============================================
  // SUPER ADMIN TRANSFER SECURITY TESTS
  // =============================================

  describe("Super Admin Transfer Security Tests", () => {
    let currentSuperAdmin: Keypair;

    before(async function () {
      if (!isInitialized) {
        this.skip();
        return;
      }

      // Get the current super admin from the program state
      const dolState = await program.account.doLState.fetch(dolStatePda);

      // Try to load the keypair for the current super admin
      try {
        const walletKeypair = Keypair.fromSecretKey(
          new Uint8Array(
            JSON.parse(
              fs.readFileSync(
                "/Users/abdirahmanhaji/.config/solana/A1.json",
                "utf-8"
              )
            )
          )
        );

        // Check if this wallet is the current super admin
        if (
          dolState.superAdmin.toString() === walletKeypair.publicKey.toString()
        ) {
          currentSuperAdmin = walletKeypair;
        } else if (
          dolState.superAdmin.toString() === admin.publicKey.toString()
        ) {
          // If our test admin is the super admin (from initialization)
          currentSuperAdmin = admin;
        } else {
          console.log("No matching super admin keypair available for tests");
          this.skip();
        }
      } catch (err) {
        // If we can't load the wallet, check if our test admin is the super admin
        if (dolState.superAdmin.toString() === admin.publicKey.toString()) {
          currentSuperAdmin = admin;
        } else {
          console.log(
            "Could not identify current super admin for security tests"
          );
          this.skip();
        }
      }
    });

    it("Fails when non-super admin tries to initiate transfer", async function () {
      if (!isInitialized || !currentSuperAdmin) {
        this.skip();
        return;
      }

      try {
        await program.methods
          .initiateSuperAdminTransfer(newSuperAdmin.publicKey)
          .accounts({
            dolState: dolStatePda,
            authority: user.publicKey, // Non-super admin
          } as any)
          .signers([user])
          .rpc();

        expect.fail(
          "Should have failed - only super admin can initiate transfer"
        );
      } catch (error: any) {
        expect(error.toString()).to.include("OnlySuperAdmin");
      }
    });

    it("Fails to transfer to zero address", async function () {
      if (!isInitialized || !currentSuperAdmin) {
        this.skip();
        return;
      }

      try {
        await program.methods
          .initiateSuperAdminTransfer(PublicKey.default)
          .accounts({
            dolState: dolStatePda,
            authority: currentSuperAdmin.publicKey,
          } as any)
          .signers([currentSuperAdmin])
          .rpc();

        expect.fail("Should have failed - cannot transfer to zero address");
      } catch (error: any) {
        expect(error.toString()).to.include("InvalidSuperAdmin");
      }
    });

    it("Fails to transfer to self", async function () {
      if (!isInitialized || !currentSuperAdmin) {
        this.skip();
        return;
      }

      try {
        await program.methods
          .initiateSuperAdminTransfer(currentSuperAdmin.publicKey)
          .accounts({
            dolState: dolStatePda,
            authority: currentSuperAdmin.publicKey,
          } as any)
          .signers([currentSuperAdmin])
          .rpc();

        expect.fail("Should have failed - cannot transfer to self");
      } catch (error: any) {
        expect(error.toString()).to.include("SelfTransferNotAllowed");
      }
    });

    it("Successfully initiates super admin transfer", async function () {
      if (!isInitialized || !currentSuperAdmin) {
        this.skip();
        return;
      }

      await program.methods
        .initiateSuperAdminTransfer(newSuperAdmin.publicKey)
        .accounts({
          dolState: dolStatePda,
          authority: currentSuperAdmin.publicKey,
        } as any)
        .signers([currentSuperAdmin])
        .rpc();

      const dolState = await program.account.doLState.fetch(dolStatePda);
      expect(dolState.pendingSuperAdmin?.toString()).to.equal(
        newSuperAdmin.publicKey.toString()
      );
      expect(dolState.transferInitiatedAt.toString()).to.not.equal("0");

      console.log("✅ Super admin transfer initiated with timelock");
    });

    it("Fails to initiate another transfer while one is pending", async function () {
      if (!isInitialized || !currentSuperAdmin) {
        this.skip();
        return;
      }

      try {
        await program.methods
          .initiateSuperAdminTransfer(maliciousUser.publicKey)
          .accounts({
            dolState: dolStatePda,
            authority: currentSuperAdmin.publicKey,
          } as any)
          .signers([currentSuperAdmin])
          .rpc();

        expect.fail("Should have failed - transfer already pending");
      } catch (error: any) {
        expect(error.toString()).to.include("TransferAlreadyPending");
      }
    });

    it("Fails to confirm transfer before timelock expires", async function () {
      if (!isInitialized || !currentSuperAdmin) {
        this.skip();
        return;
      }

      try {
        await program.methods
          .confirmSuperAdminTransfer()
          .accounts({
            dolState: dolStatePda,
            authority: currentSuperAdmin.publicKey,
          } as any)
          .signers([currentSuperAdmin])
          .rpc();

        expect.fail("Should have failed - timelock not expired");
      } catch (error: any) {
        expect(error.toString()).to.include("TimelockNotExpired");
      }
    });

    it("Successfully cancels pending transfer", async function () {
      if (!isInitialized || !currentSuperAdmin) {
        this.skip();
        return;
      }

      await program.methods
        .cancelSuperAdminTransfer()
        .accounts({
          dolState: dolStatePda,
          authority: currentSuperAdmin.publicKey,
        } as any)
        .signers([currentSuperAdmin])
        .rpc();

      const dolState = await program.account.doLState.fetch(dolStatePda);
      expect(dolState.pendingSuperAdmin).to.be.null;
      expect(dolState.transferInitiatedAt.toString()).to.equal("0");

      console.log("✅ Super admin transfer cancelled successfully");
    });

    it("Fails to cancel when no transfer is pending", async function () {
      if (!isInitialized || !currentSuperAdmin) {
        this.skip();
        return;
      }

      try {
        await program.methods
          .cancelSuperAdminTransfer()
          .accounts({
            dolState: dolStatePda,
            authority: currentSuperAdmin.publicKey,
          } as any)
          .signers([currentSuperAdmin])
          .rpc();

        expect.fail("Should have failed - no transfer pending");
      } catch (error: any) {
        expect(error.toString()).to.include("NoPendingTransfer");
      }
    });
  });

  // =============================================
  // EMERGENCY RECOVERY TESTS
  // =============================================

  describe("Emergency Recovery Security Tests", () => {
    let currentSuperAdmin: Keypair;
    let admin2: Keypair;

    before(async function () {
      if (!isInitialized) {
        this.skip();
        return;
      }

      // Get the current super admin from the program state
      const dolState = await program.account.doLState.fetch(dolStatePda);

      // Try to identify the current super admin keypair
      try {
        const walletKeypair = Keypair.fromSecretKey(
          new Uint8Array(
            JSON.parse(
              fs.readFileSync(
                "/Users/abdirahmanhaji/.config/solana/A1.json",
                "utf-8"
              )
            )
          )
        );

        // Check if this wallet is the current super admin
        if (
          dolState.superAdmin.toString() === walletKeypair.publicKey.toString()
        ) {
          currentSuperAdmin = walletKeypair;
        } else if (
          dolState.superAdmin.toString() === admin.publicKey.toString()
        ) {
          // If our test admin is the super admin (from initialization)
          currentSuperAdmin = admin;
        } else {
          console.log(
            "No matching super admin keypair available for emergency recovery tests"
          );
          this.skip();
          return;
        }

        // Create and fund a second admin
        admin2 = Keypair.generate();
        await provider.connection.confirmTransaction(
          await provider.connection.requestAirdrop(
            admin2.publicKey,
            2 * anchor.web3.LAMPORTS_PER_SOL
          ),
          "confirmed"
        );

        // Add second admin to have enough for emergency recovery
        try {
          await program.methods
            .addAdmin(admin2.publicKey)
            .accounts({
              dolState: dolStatePda,
              authority: currentSuperAdmin.publicKey,
            } as any)
            .signers([currentSuperAdmin])
            .rpc();
        } catch (err) {
          console.log("Admin2 may already exist:", err);
        }
      } catch (err) {
        // If we can't load the wallet, check if our test admin is the super admin
        if (dolState.superAdmin.toString() === admin.publicKey.toString()) {
          currentSuperAdmin = admin;
          // Still try to create admin2
          admin2 = Keypair.generate();
          await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(
              admin2.publicKey,
              2 * anchor.web3.LAMPORTS_PER_SOL
            ),
            "confirmed"
          );

          try {
            await program.methods
              .addAdmin(admin2.publicKey)
              .accounts({
                dolState: dolStatePda,
                authority: currentSuperAdmin.publicKey,
              } as any)
              .signers([currentSuperAdmin])
              .rpc();
          } catch (err) {
            console.log("Admin2 may already exist:", err);
          }
        } else {
          console.log("Could not setup emergency recovery tests");
          this.skip();
        }
      }
    });

    it("Fails when non-admin tries to initiate emergency recovery", async function () {
      if (!isInitialized || !currentSuperAdmin) {
        this.skip();
        return;
      }

      try {
        await program.methods
          .initiateEmergencyRecovery(newSuperAdmin.publicKey)
          .accounts({
            dolState: dolStatePda,
            authority: user.publicKey, // Non-admin
          } as any)
          .signers([user])
          .rpc();

        expect.fail("Should have failed - only admins can initiate recovery");
      } catch (error: any) {
        expect(error.toString()).to.include("InsufficientPermissions");
      }
    });

    it("Successfully initiates emergency recovery", async function () {
      if (!isInitialized || !currentSuperAdmin) {
        this.skip();
        return;
      }

      await program.methods
        .initiateEmergencyRecovery(newSuperAdmin.publicKey)
        .accounts({
          dolState: dolStatePda,
          authority: admin.publicKey,
        } as any)
        .signers([admin])
        .rpc();

      const dolState = await program.account.doLState.fetch(dolStatePda);
      expect(dolState.emergencyRecoveryNewAdmin?.toString()).to.equal(
        newSuperAdmin.publicKey.toString()
      );
      expect(dolState.emergencyRecoveryVotes.length).to.equal(1);

      console.log("✅ Emergency recovery initiated");
    });

    it("Fails to vote twice for emergency recovery", async function () {
      if (!isInitialized || !currentSuperAdmin) {
        this.skip();
        return;
      }

      try {
        await program.methods
          .voteEmergencyRecovery()
          .accounts({
            dolState: dolStatePda,
            authority: admin.publicKey,
          } as any)
          .signers([admin])
          .rpc();

        expect.fail("Should have failed - already voted");
      } catch (error: any) {
        expect(error.toString()).to.include("AlreadyVotedForRecovery");
      }
    });

    it("Successfully completes emergency recovery with enough votes", async function () {
      if (!isInitialized || !currentSuperAdmin || !admin2) {
        this.skip();
        return;
      }

      // Second admin votes to reach threshold
      await program.methods
        .voteEmergencyRecovery()
        .accounts({
          dolState: dolStatePda,
          authority: admin2.publicKey,
        } as any)
        .signers([admin2])
        .rpc();

      const dolState = await program.account.doLState.fetch(dolStatePda);
      expect(dolState.superAdmin.toString()).to.equal(
        newSuperAdmin.publicKey.toString()
      );
      expect(dolState.emergencyRecoveryNewAdmin).to.be.null;
      expect(dolState.emergencyRecoveryVotes.length).to.equal(0);

      console.log("✅ Emergency recovery executed successfully");
    });

    it("Super admin can cancel emergency recovery", async function () {
      if (!isInitialized) {
        this.skip();
        return;
      }

      // Initiate new recovery to test cancellation
      await program.methods
        .initiateEmergencyRecovery(maliciousUser.publicKey)
        .accounts({
          dolState: dolStatePda,
          authority: admin.publicKey,
        } as any)
        .signers([admin])
        .rpc();

      // New super admin cancels it
      await program.methods
        .cancelEmergencyRecovery()
        .accounts({
          dolState: dolStatePda,
          authority: newSuperAdmin.publicKey,
        } as any)
        .signers([newSuperAdmin])
        .rpc();

      const dolState = await program.account.doLState.fetch(dolStatePda);
      expect(dolState.emergencyRecoveryNewAdmin).to.be.null;

      console.log("✅ Emergency recovery cancelled by super admin");
    });
  });
});
