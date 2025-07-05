import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CounterProgram } from "../target/types/counter_program";
import { expect } from "chai";

describe("counter-program", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.CounterProgram as Program<CounterProgram>;
  const provider = anchor.getProvider();

  it("Is initialized!", async () => {
    // Generate a new keypair for the user
    const user = anchor.web3.Keypair.generate();

    // Airdrop SOL to the user
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(
        user.publicKey,
        2 * anchor.web3.LAMPORTS_PER_SOL
      ),
      "confirmed"
    );

    // Find the counter PDA
    const [counterPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("counter"), user.publicKey.toBuffer()],
      program.programId
    );

    // Initialize the counter
    const tx = await program.methods
      .initialize()
      .accounts({
        counter: counterPda,
        user: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      } as any)
      .signers([user])
      .rpc();

    console.log("Your transaction signature", tx);

    // Fetch and verify the counter
    const counter = await program.account.counter.fetch(counterPda);
    expect(counter.count.toNumber()).to.equal(0);
    expect(counter.authority.toString()).to.equal(user.publicKey.toString());
  });
});
