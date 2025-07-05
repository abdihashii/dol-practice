import { Keypair, PublicKey } from "@solana/web3.js";
import { createHash, randomUUID } from "crypto";
import * as fs from "fs";
import { PROGRAM_ID } from "./constants";

export async function loadKeypair(keypairPath: string): Promise<Keypair> {
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  return Keypair.fromSecretKey(new Uint8Array(keypairData));
}

export function getDoLStatePDA(): PublicKey {
  const [dolStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("dol_state")],
    PROGRAM_ID
  );
  return dolStatePDA;
}

export function getLibraryCardPDA(userPublicKey: PublicKey): PublicKey {
  const [libraryCardPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("library_card"), userPublicKey.toBuffer()],
    PROGRAM_ID
  );
  return libraryCardPDA;
}

export function getBookPDA(bookId: Uint8Array): PublicKey {
  const [bookPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("book"), bookId],
    PROGRAM_ID
  );
  return bookPDA;
}

export function generateBookId(): Uint8Array {
  const uuid = randomUUID();
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function getInstructionDiscriminator(instructionName: string): Buffer {
  const hash = createHash("sha256")
    .update(`global:${instructionName}`)
    .digest();
  return hash.subarray(0, 8);
}

export function validateIpfsHash(hash: string): boolean {
  return hash.length >= 32 && (hash.startsWith("Qm") || hash.startsWith("baf"));
}

export function showUsage(): void {
  console.log("Usage:");
  console.log("  pnpm start <command> --keypair <path_to_keypair>");
  console.log("");
  console.log("📚 Book Management Commands:");
  console.log(
    "  add-book --keypair <path> --title <title> --author <author> --ipfs <hash> --genre <genre> - Add book (admin/curator)"
  );
  console.log(
    "  update-book --keypair <path> --book-id <id> [--title <title>] [--author <author>] [--ipfs <hash>] [--genre <genre>] - Update book (admin/curator)"
  );
  console.log(
    "  remove-book --keypair <path> --book-id <id> - Remove book (admin only)"
  );
  console.log("  get-book <book_id> - Get book information (public)");
  console.log("");
  console.log("🎫 User Commands:");
  console.log(
    "  initialize --keypair <path> - Initialize DoL program (super admin only)"
  );
  console.log("  mint-card --keypair <path> - Mint library card");
  console.log(
    "  get-library-card <wallet_address> - View library card information (public)"
  );
  console.log("");
  console.log("👨‍💼 Admin Management Commands:");
  console.log(
    "  add-admin --keypair <path> --admin <pubkey> - Add new admin (super admin/admin only)"
  );
  console.log(
    "  remove-admin --keypair <path> --admin <pubkey> - Remove admin (super admin only)"
  );
  console.log(
    "  add-curator --keypair <path> --curator <pubkey> - Add curator (super admin/admin only)"
  );
  console.log(
    "  remove-curator --keypair <path> --curator <pubkey> - Remove curator (super admin/admin only)"
  );
  console.log(
    "  transfer-super-admin --keypair <path> --new-super-admin <pubkey> - Transfer super admin (super admin only)"
  );
  console.log("");
  console.log("🚨 Emergency Controls:");
  console.log(
    "  pause-program --keypair <path> - Pause all program operations (super admin only)"
  );
  console.log(
    "  unpause-program --keypair <path> - Resume program operations (super admin only)"
  );
}
