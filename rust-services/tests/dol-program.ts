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

  // Hardcoded super admin key from the program
  const SUPER_ADMIN_KEY = new PublicKey(
    "AfuXGptXuHDGpnAL5V27fUkNkHTVcDPGgF1cGbmTena"
  );

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

      // If initialized, add our test admin as an admin
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

      // Check if super admin matches
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
      }
    } catch (err) {
      console.log(
        "DoL state not initialized - will use mock initialization for tests"
      );
    }
  });

  it("Initializes DoL state with admin", async () => {
    // This test demonstrates the initialization flow
    // In production, only the hardcoded super admin can initialize
    try {
      const dolState = await program.account.doLState.fetch(dolStatePda);
      console.log("✅ DoL state already initialized");
      console.log("📍 Super admin:", dolState.superAdmin.toString());
      console.log("📚 Book count:", dolState.bookCount.toString());
      console.log("🔢 Version:", dolState.version);
      isInitialized = true;
    } catch (err) {
      console.log("⚠️ DoL state not initialized");
      console.log("📍 Expected super admin:", SUPER_ADMIN_KEY.toString());
      console.log(
        "ℹ️ To initialize, run: 'anchor run init-dol' with the correct super admin wallet"
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
  // SUPER ADMIN TRANSFER SECURITY TESTS
  // =============================================

  describe("Super Admin Transfer Security Tests", () => {
    let superAdminKeypair: Keypair;

    before(async function () {
      if (!isInitialized) {
        this.skip();
        return;
      }

      // Load the actual super admin keypair for testing
      try {
        superAdminKeypair = Keypair.fromSecretKey(
          new Uint8Array(
            JSON.parse(
              fs.readFileSync(
                "/Users/abdirahmanhaji/.config/solana/A1.json",
                "utf-8"
              )
            )
          )
        );
      } catch (err) {
        console.log("Could not load super admin keypair for security tests");
        this.skip();
      }
    });

    it("Fails when non-super admin tries to initiate transfer", async function () {
      if (!isInitialized || !superAdminKeypair) {
        this.skip();
        return;
      }

      try {
        await program.methods
          .initiateSuperAdminTransfer(newSuperAdmin.publicKey)
          .accounts({
            dolState: dolStatePda,
            authority: admin.publicKey, // Non-super admin
          } as any)
          .signers([admin])
          .rpc();

        expect.fail(
          "Should have failed - only super admin can initiate transfer"
        );
      } catch (error: any) {
        expect(error.toString()).to.include("OnlySuperAdmin");
      }
    });

    it("Fails to transfer to zero address", async function () {
      if (!isInitialized || !superAdminKeypair) {
        this.skip();
        return;
      }

      try {
        await program.methods
          .initiateSuperAdminTransfer(PublicKey.default)
          .accounts({
            dolState: dolStatePda,
            authority: superAdminKeypair.publicKey,
          } as any)
          .signers([superAdminKeypair])
          .rpc();

        expect.fail("Should have failed - cannot transfer to zero address");
      } catch (error: any) {
        expect(error.toString()).to.include("InvalidSuperAdmin");
      }
    });

    it("Fails to transfer to self", async function () {
      if (!isInitialized || !superAdminKeypair) {
        this.skip();
        return;
      }

      try {
        await program.methods
          .initiateSuperAdminTransfer(superAdminKeypair.publicKey)
          .accounts({
            dolState: dolStatePda,
            authority: superAdminKeypair.publicKey,
          } as any)
          .signers([superAdminKeypair])
          .rpc();

        expect.fail("Should have failed - cannot transfer to self");
      } catch (error: any) {
        expect(error.toString()).to.include("SelfTransferNotAllowed");
      }
    });

    it("Successfully initiates super admin transfer", async function () {
      if (!isInitialized || !superAdminKeypair) {
        this.skip();
        return;
      }

      await program.methods
        .initiateSuperAdminTransfer(newSuperAdmin.publicKey)
        .accounts({
          dolState: dolStatePda,
          authority: superAdminKeypair.publicKey,
        } as any)
        .signers([superAdminKeypair])
        .rpc();

      const dolState = await program.account.doLState.fetch(dolStatePda);
      expect(dolState.pendingSuperAdmin?.toString()).to.equal(
        newSuperAdmin.publicKey.toString()
      );
      expect(dolState.transferInitiatedAt.toString()).to.not.equal("0");

      console.log("✅ Super admin transfer initiated with timelock");
    });

    it("Fails to initiate another transfer while one is pending", async function () {
      if (!isInitialized || !superAdminKeypair) {
        this.skip();
        return;
      }

      try {
        await program.methods
          .initiateSuperAdminTransfer(maliciousUser.publicKey)
          .accounts({
            dolState: dolStatePda,
            authority: superAdminKeypair.publicKey,
          } as any)
          .signers([superAdminKeypair])
          .rpc();

        expect.fail("Should have failed - transfer already pending");
      } catch (error: any) {
        expect(error.toString()).to.include("TransferAlreadyPending");
      }
    });

    it("Fails to confirm transfer before timelock expires", async function () {
      if (!isInitialized || !superAdminKeypair) {
        this.skip();
        return;
      }

      try {
        await program.methods
          .confirmSuperAdminTransfer()
          .accounts({
            dolState: dolStatePda,
            authority: superAdminKeypair.publicKey,
          } as any)
          .signers([superAdminKeypair])
          .rpc();

        expect.fail("Should have failed - timelock not expired");
      } catch (error: any) {
        expect(error.toString()).to.include("TimelockNotExpired");
      }
    });

    it("Successfully cancels pending transfer", async function () {
      if (!isInitialized || !superAdminKeypair) {
        this.skip();
        return;
      }

      await program.methods
        .cancelSuperAdminTransfer()
        .accounts({
          dolState: dolStatePda,
          authority: superAdminKeypair.publicKey,
        } as any)
        .signers([superAdminKeypair])
        .rpc();

      const dolState = await program.account.doLState.fetch(dolStatePda);
      expect(dolState.pendingSuperAdmin).to.be.null;
      expect(dolState.transferInitiatedAt.toString()).to.equal("0");

      console.log("✅ Super admin transfer cancelled successfully");
    });

    it("Fails to cancel when no transfer is pending", async function () {
      if (!isInitialized || !superAdminKeypair) {
        this.skip();
        return;
      }

      try {
        await program.methods
          .cancelSuperAdminTransfer()
          .accounts({
            dolState: dolStatePda,
            authority: superAdminKeypair.publicKey,
          } as any)
          .signers([superAdminKeypair])
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
    let superAdminKeypair: Keypair;
    let admin2: Keypair;

    before(async function () {
      if (!isInitialized) {
        this.skip();
        return;
      }

      // Load the actual super admin keypair for testing
      try {
        superAdminKeypair = Keypair.fromSecretKey(
          new Uint8Array(
            JSON.parse(
              fs.readFileSync(
                "/Users/abdirahmanhaji/.config/solana/A1.json",
                "utf-8"
              )
            )
          )
        );

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
              authority: superAdminKeypair.publicKey,
            } as any)
            .signers([superAdminKeypair])
            .rpc();
        } catch (err) {
          console.log("Admin2 may already exist:", err);
        }
      } catch (err) {
        console.log("Could not setup emergency recovery tests");
        this.skip();
      }
    });

    it("Fails when non-admin tries to initiate emergency recovery", async function () {
      if (!isInitialized || !superAdminKeypair) {
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
      if (!isInitialized || !superAdminKeypair) {
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
      if (!isInitialized || !superAdminKeypair) {
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
      if (!isInitialized || !superAdminKeypair || !admin2) {
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
