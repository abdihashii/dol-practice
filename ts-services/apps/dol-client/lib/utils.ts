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
    PROGRAM_ID,
  );
  return dolStatePDA;
}

export function getLibraryCardPDA(userPublicKey: PublicKey): PublicKey {
  const [libraryCardPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("library_card"), userPublicKey.toBuffer()],
    PROGRAM_ID,
  );
  return libraryCardPDA;
}

export function getBookPDA(bookId: Uint8Array): PublicKey {
  const [bookPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("book"), bookId],
    PROGRAM_ID,
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
  // Basic length and prefix validation
  if (hash.length < 32 || !(hash.startsWith("Qm") || hash.startsWith("baf"))) {
    return false;
  }

  // Validate character sets based on IPFS hash type
  if (hash.startsWith("Qm")) {
    // CIDv0 - Base58 validation (Bitcoin alphabet without 0, O, I, l)
    const BASE58_CHARS =
      "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    return hash.split("").every((char) => BASE58_CHARS.includes(char));
  } else if (hash.startsWith("baf")) {
    // CIDv1 - Base32 validation (RFC 4648 lowercase)
    const BASE32_CHARS = "abcdefghijklmnopqrstuvwxyz234567";
    // Skip the first 3 characters ("baf") and validate the rest
    return hash
      .slice(3)
      .split("")
      .every((char) => BASE32_CHARS.includes(char));
  }

  return false;
}

export function showUsage(): void {
  console.log("Usage:");
  console.log("  pnpm start <command> --keypair <path_to_keypair>");
  console.log("");
  console.log("📚 Book Management Commands:");
  console.log(
    "  add-book --keypair <path> --title <title> --author <author> --ipfs <hash> --genre <genre> - Add book (admin/curator)",
  );
  console.log(
    "  update-book --keypair <path> --book-id <id> [--title <title>] [--author <author>] [--ipfs <hash>] [--genre <genre>] - Update book (admin/curator)",
  );
  console.log(
    "  remove-book --keypair <path> --book-id <id> - Remove book (admin only)",
  );
  console.log("  get-book <book_id> - Get book information (public)");
  console.log("");
  console.log("📊 Status Commands:");
  console.log("  status - Check DoL program status (public)");
  console.log("");
  console.log("🎫 User Commands:");
  console.log(
    "  initialize --keypair <path> - Initialize DoL program (any wallet becomes super admin)",
  );
  console.log("  mint-card --keypair <path> - Mint library card");
  console.log(
    "  get-library-card <wallet_address> - View library card information (public)",
  );
  console.log("");
  console.log("👨‍💼 Admin Management Commands:");
  console.log(
    "  add-admin --keypair <path> --admin <pubkey> - Add new admin (super admin/admin only)",
  );
  console.log(
    "  remove-admin --keypair <path> --admin <pubkey> - Remove admin (super admin only)",
  );
  console.log(
    "  add-curator --keypair <path> --curator <pubkey> - Add curator (super admin/admin only)",
  );
  console.log(
    "  remove-curator --keypair <path> --curator <pubkey> - Remove curator (super admin/admin only)",
  );
  console.log("");
  console.log("🔐 Secure Super Admin Transfer (7-day timelock):");
  console.log(
    "  initiate-super-admin-transfer --keypair <path> --new-super-admin <pubkey> - Start transfer (super admin only)",
  );
  console.log(
    "  confirm-super-admin-transfer --keypair <path> - Complete transfer after timelock (super admin only)",
  );
  console.log(
    "  cancel-super-admin-transfer --keypair <path> - Cancel pending transfer (super admin only)",
  );
  console.log("");
  console.log("🚨 Emergency Recovery (Multi-admin signatures):");
  console.log(
    "  initiate-emergency-recovery --keypair <path> --new-super-admin <pubkey> - Start recovery (admin only)",
  );
  console.log(
    "  vote-emergency-recovery --keypair <path> - Vote for recovery (admin only)",
  );
  console.log("");
  console.log("🚨 Emergency Controls:");
  console.log(
    "  pause-program --keypair <path> - Pause all program operations (super admin only)",
  );
  console.log(
    "  unpause-program --keypair <path> - Resume program operations (super admin only)",
  );
  console.log("");
  console.log("💡 Security Notes:");
  console.log("  • For production: Initialize with a multi-signature wallet");
  console.log(
    "  • Rate limiting: 50 books/day max, 60s cooldown between additions",
  );
  console.log("  • Super admin transfers have 7-day timelock for security");
  console.log("  • Emergency recovery requires multiple admin signatures");
}
