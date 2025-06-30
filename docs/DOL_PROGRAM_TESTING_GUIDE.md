# DoL Program Testing Guide

This guide provides comprehensive instructions for testing the Decentralized Open Library (DoL) program on both local testnet and Solana devnet.

## Table of Contents

- [Overview](#overview)
- [Prerequisites](#prerequisites)
- [Part 1: Local Testing](#part-1-local-testing)
- [Part 2: Devnet Testing](#part-2-devnet-testing)
- [Part 3: Testing Scenarios](#part-3-testing-scenarios)
- [Part 4: Troubleshooting](#part-4-troubleshooting)

## Overview

This guide covers testing procedures for the Decentralized Open Library (DoL) program on both local and devnet environments.

For detailed program architecture, features, and account structures, see the [DoL Program README](../rust-services/programs/dol-program/README.md).

## Prerequisites

Ensure you have the following installed:

```bash
# Check installations
solana --version  # v1.18+ recommended
anchor --version  # v0.30+ recommended
node --version    # v18+ recommended
pnpm --version    # v8+ recommended

# Install if needed
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
cargo install --git https://github.com/coral-xyz/anchor avm --force
avm install latest
avm use latest
```

## Part 1: Local Testing

### 1.1 Start Local Test Validator

```bash
# Terminal 1: Start a fresh local validator
solana-test-validator --reset

# The validator will show:
# - RPC URL: http://127.0.0.1:8899
# - WebSocket URL: ws://127.0.0.1:8900
# - Ledger location: test-ledger
```

### 1.2 Configure Solana CLI

```bash
# Terminal 2: Set cluster to localhost
solana config set --url localhost

# Verify configuration
solana config get
# Expected output:
# RPC URL: http://localhost:8899
# WebSocket URL: ws://localhost:8900 (computed)
# Keypair Path: /Users/you/.config/solana/id.json
```

### 1.3 Build and Deploy

```bash
# Navigate to the rust-services directory
cd /path/to/dol-practice/rust-services

# Build the program
anchor build

# Deploy to local testnet
anchor deploy

# Note the program ID from the output
# Example: Program Id: DoLotrsAZR2JYa4tjue2c5q4EYKMbm6kxcrvjbU5cxX5
```

### 1.4 Run Anchor Tests

```bash
# Run the test suite with existing validator
anchor test --skip-local-validator

# Expected output:
# ✔ Mints library card for user
# ✔ Admin adds book to catalog
# ✔ Fails to add book with invalid UUID (all zeros)
# ✔ Fails to add book with invalid UUID v4 format
# ...
```

### 1.5 Manual Testing with TypeScript Client

```bash
# Navigate to the TypeScript client
cd ../ts-services/apps/dol-client

# Install dependencies
pnpm install

# View available commands
pnpm start --help
```

#### Initialize the Program (Super Admin Only)

```bash
# Note: Requires the hardcoded super admin key or update the key in lib.rs
pnpm start initialize --keypair ~/.config/solana/id.json
```

#### Mint a Library Card

```bash
# Any user can mint one library card
pnpm start mint-card --keypair ~/.config/solana/id.json

# Output:
# 🎫 Minting library card...
# ✅ Library card minted!
# 📍 Library Card address: <PDA_ADDRESS>
# 👤 Owner: <YOUR_PUBKEY>
```

#### Add a Book (Admin/Curator Only)

```bash
pnpm start add-book \
  --keypair ~/.config/solana/id.json \
  --title "1984" \
  --author "George Orwell" \
  --ipfs "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG" \
  --genre "Dystopian"

# Output:
# 📚 Adding book...
# ✅ Book added!
# 📖 Title: 1984
# ✍️  Author: George Orwell
# 🆔 Book ID: <UUID_PREFIX>
```

#### Get Book Information

```bash
# Retrieve book details (public access)
pnpm start get-book <BOOK_ID>
```

### 1.6 Verify Account Changes

```bash
# Check program logs
solana logs | grep "DoL"

# Inspect specific accounts
solana account <DOL_STATE_PDA>
solana account <LIBRARY_CARD_PDA>
solana account <BOOK_PDA>
```

## Part 2: Devnet Testing

### 2.1 Configure for Devnet

```bash
# Switch to devnet
solana config set --url devnet

# Verify
solana config get
# Expected: RPC URL: https://api.devnet.solana.com
```

### 2.2 Get Devnet SOL

```bash
# Request airdrop (2 SOL max per request)
solana airdrop 2

# Check balance
solana balance

# If airdrop fails, use web faucet:
# https://faucet.solana.com/
```

### 2.3 Deploy to Devnet

```bash
# Build program (if not already built)
anchor build

# Deploy to devnet
anchor deploy --provider.cluster devnet

# Save the program ID!
# Update Anchor.toml with the deployed program ID
```

### 2.4 Update Configuration Files

```toml
# Anchor.toml
[programs.devnet]
dol_program = "YOUR_DEVNET_PROGRAM_ID"

[provider]
cluster = "Devnet"
```

```typescript
// ts-services/apps/dol-client/lib/constants.ts
export const PROGRAM_ID = new PublicKey("YOUR_DEVNET_PROGRAM_ID");
```

### 2.5 Run Tests on Devnet

```bash
# Run TypeScript client commands with devnet program
cd ts-services/apps/dol-client

# Initialize (super admin only)
pnpm start initialize --keypair ~/.config/solana/id.json

# Test all functionality
pnpm start mint-card --keypair ~/.config/solana/id.json
pnpm start add-book --keypair ~/.config/solana/id.json \
  --title "Brave New World" \
  --author "Aldous Huxley" \
  --ipfs "QmValidIpfsHashHere" \
  --genre "Dystopian"
```

### 2.6 Monitor on Solana Explorer

```bash
# View your transactions
echo "https://explorer.solana.com/address/YOUR_PROGRAM_ID?cluster=devnet"

# View specific transaction
echo "https://explorer.solana.com/tx/TRANSACTION_SIGNATURE?cluster=devnet"
```

## Part 3: Testing Scenarios

### 3.1 UUID Validation Tests

#### Valid UUID v4 for Books

```javascript
// TypeScript client generates valid UUID v4 automatically
const bookId = generateBookId(); // Uses crypto.randomUUID()
```

#### Invalid UUID Tests

```bash
# Test 1: All zeros (should fail)
# The test suite includes this scenario

# Test 2: Wrong UUID version (should fail)
# UUID with version 3 instead of 4

# Test 3: Invalid variant bits (should fail)
# Malformed UUID structure
```

### 3.2 Library Card Tests

#### Single Card per User

```bash
# First mint: Success
pnpm start mint-card --keypair ~/.config/solana/id.json

# Second mint: Should fail (PDA already exists)
pnpm start mint-card --keypair ~/.config/solana/id.json
# Error: Account already exists
```

### 3.3 Role-Based Access Tests

#### Admin Operations

```bash
# Add admin (super admin only)
pnpm start add-admin --keypair <SUPER_ADMIN_KEY> --admin <NEW_ADMIN_PUBKEY>

# Remove book (admin only)
pnpm start remove-book --keypair <ADMIN_KEY> --book-id <BOOK_ID>
```

#### Program Control

```bash
# Pause program (super admin only)
pnpm start pause-program --keypair <SUPER_ADMIN_KEY>

# Try adding book while paused (should fail)
pnpm start add-book --keypair <ADMIN_KEY> --title "Test" ...
# Error: Program is paused

# Unpause program
pnpm start unpause-program --keypair <SUPER_ADMIN_KEY>
```

### 3.4 Book Management Tests

#### Add Book with Validation

```bash
# Valid IPFS hash formats
--ipfs "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"  # CIDv0
--ipfs "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi"  # CIDv1

# Invalid IPFS hash (should fail)
--ipfs "invalid_hash"
# Error: Invalid IPFS hash
```

#### Update Book Metadata

```bash
pnpm start update-book \
  --keypair <CURATOR_KEY> \
  --book-id <BOOK_ID> \
  --title "Updated Title" \
  --genre "Updated Genre"
```

## Part 4: Troubleshooting

### Common Issues and Solutions

#### 1. Connection Refused Error

```bash
Error: error trying to connect: tcp connect error: Connection refused (os error 61)

# Solution: Ensure test validator is running
solana-test-validator --reset
```

#### 2. Insufficient Funds

```bash
Error: Attempt to debit an account but found no record of a prior credit

# Solution: Airdrop SOL
solana airdrop 2
```

#### 3. Program Not Found

```bash
Error: AccountNotFound

# Solution: Deploy the program first
anchor deploy
```

#### 4. Invalid UUID Error

```bash
Error: InvalidBookId

# Solution: Ensure UUID v4 format
# Valid: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
# Where y is one of 8, 9, A, or B
```

#### 5. Transaction Too Large

```bash
Error: Transaction too large

# Solution: Reduce string lengths or batch operations
```

### Debugging Tips

1. **Enable Detailed Logs**

   ```bash
   export RUST_LOG=solana_runtime::system_instruction_processor=trace,solana_runtime::message_processor=trace,solana_bpf_loader=debug,solana_rbpf=debug
   ```

2. **Watch Program Logs**

   ```bash
   solana logs | grep -E "Program (DoL|log)"
   ```

3. **Inspect Transaction Details**

   ```bash
   solana confirm -v <TRANSACTION_SIGNATURE>
   ```

4. **Check Account Data**
   ```bash
   solana account <ACCOUNT_PUBKEY> --output json | jq
   ```

### Performance Considerations

- **Local Testing**: Near-instant transactions, ideal for development
- **Devnet Testing**: ~400ms block times, realistic network conditions
- **Storage Costs**: See [DoL Program README](../rust-services/programs/dol-program/README.md#storage-costs) for detailed account sizes

### Security Best Practices

1. **Never share private keys**
2. **Use separate keypairs for testing**
3. **Validate all inputs client-side and on-chain**
4. **Test role-based permissions thoroughly**
5. **Ensure UUID validation prevents duplicates**

## Next Steps

- Review the [DoL Program README](../rust-services/programs/dol-program/README.md) for architecture details
- Read the [Product Requirements Document](./PRD.md) for feature specifications
- Explore the program source code in `rust-services/programs/dol-program/src/lib.rs`
- Contribute to the TypeScript client in `ts-services/apps/dol-client`
- Deploy to mainnet-beta when ready for production

## Support

For issues or questions:

- Check the program logs first
- Review error messages carefully
- Ensure all prerequisites are installed
- Verify network connectivity

Happy testing! 📚
