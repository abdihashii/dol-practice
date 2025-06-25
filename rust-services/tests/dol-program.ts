import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DolProgram } from "../target/types/dol_program";
import { PublicKey, Keypair } from "@solana/web3.js";
import { expect } from "chai";

describe("dol-program", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.dolProgram as Program<DolProgram>;
  const provider = anchor.getProvider();

  let admin: Keypair;
  let user: Keypair;
  let dolStatePda: PublicKey;
  let libraryCardPda: PublicKey;
  let bookPda: PublicKey;

  const bookId = Array.from(crypto.getRandomValues(new Uint8Array(16)));
  const mockIpfsHash = "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG";

  before(async () => {
    admin = Keypair.generate();
    user = Keypair.generate();

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
  });

  it("Initializes DoL state with admin", async () => {
    const tx = await program.methods
      .initialize()
      .accounts({
        dolState: dolStatePda,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([admin])
      .rpc();

    const dolState = await program.account.doLState.fetch(dolStatePda);

    expect(dolState.admin.toString()).to.equal(admin.publicKey.toString());
    expect(dolState.bookCount.toString()).to.equal("0");
    expect(dolState.version).to.equal(1);

    console.log("DoL state initialized with admin:", dolState.admin.toString());
  });

  it("Mints library card for user", async () => {
    const tx = await program.methods
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
    expect(libraryCard.cardId.toString()).to.not.be.empty;
    expect(libraryCard.mintTimestamp.toString()).to.not.be.empty;

    console.log("Library card minted for:", libraryCard.owner.toString());
  });

  it("Admin adds book to catalog", async () => {
    const title = "The Great Gatsby";
    const author = "F. Scott Fitzgerald";
    const genre = "Classic";

    const tx = await program.methods
      .addBook(bookId, title, author, mockIpfsHash, genre)
      .accounts({
        dolState: dolStatePda,
        book: bookPda,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
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

  it("Retrieves book information", async () => {
    const tx = await program.methods
      .getBook()
      .accounts({
        book: bookPda,
      })
      .rpc();

    console.log("Book information retrieved successfully");
  });

  it("Verifies library card access", async () => {
    const tx = await program.methods
      .verifyAccess()
      .accounts({
        libraryCard: libraryCardPda,
      })
      .rpc();

    console.log("Library card access verified");
  });

  it("Fails to add book with invalid UUID (all zeros)", async () => {
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
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      expect.fail("Should have failed with invalid book ID");
    } catch (error) {
      expect(error.message).to.include("InvalidBookId");
    }
  });

  it("Fails to add book with invalid IPFS hash", async () => {
    const newBookId = Array.from(crypto.getRandomValues(new Uint8Array(16)));
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
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      expect.fail("Should have failed with invalid IPFS hash");
    } catch (error) {
      expect(error.message).to.include("InvalidIpfsHash");
    }
  });

  it("Fails to add book with empty title", async () => {
    const newBookId = Array.from(crypto.getRandomValues(new Uint8Array(16)));

    try {
      await program.methods
        .addBook(newBookId, "", "Test Author", mockIpfsHash, "Fiction")
        .accounts({
          dolState: dolStatePda,
          book: PublicKey.findProgramAddressSync(
            [Buffer.from("book"), Buffer.from(newBookId)],
            program.programId
          )[0],
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      expect.fail("Should have failed with empty title");
    } catch (error) {
      expect(error.message).to.include("TitleTooLong");
    }
  });

  it("Fails when non-admin tries to add book", async () => {
    const newBookId = Array.from(crypto.getRandomValues(new Uint8Array(16)));

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
          admin: user.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([user])
        .rpc();

      expect.fail("Should have failed with unauthorized access");
    } catch (error) {
      expect(error.message).to.include("ConstraintHasOne");
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
    } catch (error) {
      expect(error.message).to.include("already in use");
    }
  });
});
