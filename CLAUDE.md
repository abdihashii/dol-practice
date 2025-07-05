# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the Decentralized Open Library (DoL) - a Web3 public good on Solana blockchain. It's a monorepo containing:

- **rust-services/**: Solana programs (smart contracts) using Anchor framework
- **ts-services/**: TypeScript client applications

## Essential Commands

### Building and Testing Solana Programs

```bash
# Start local validator (Terminal 1)
solana-test-validator --reset

# Build and deploy (Terminal 2)
cd rust-services
anchor build
anchor deploy
anchor test --skip-local-validator

# Deploy to devnet
solana config set --url devnet
anchor deploy --provider.cluster devnet
```

### Running Client Applications

```bash
# DoL Client
cd ts-services/apps/dol-client
pnpm install
pnpm start initialize --keypair ~/.config/solana/id.json
pnpm start mint-card --keypair ~/.config/solana/id.json

# Counter Client (for testing)
cd ts-services/apps/counter-client
pnpm start initialize --keypair ~/.config/solana/id.json
```

### Linting and Code Quality

```bash
cd rust-services
pnpm lint      # Check formatting
pnpm lint:fix  # Auto-fix formatting
```

### Debugging Commands

```bash
solana logs | grep "DoL"  # Watch DoL program logs
solana logs | grep "Program"  # Watch all program logs
```

## Architecture Overview

### Solana Programs (rust-services/programs/)

1. **dol-program**: Main library program with:
   - PDA-based state management (DOL_STATE_SEED = "dol-state")
   - Role-based access: SuperAdmin → Admins → Curators
   - UUID v4 validation for unique book/card identifiers
   - Program pause/unpause functionality
   - Book catalog with IPFS hash storage

2. **counter-program**: Simple counter for testing/learning

### Key Design Patterns

- **PDAs (Program Derived Addresses)**: Used for deterministic account addresses
- **Access Control**: Hierarchical role system with specific permissions
- **Validation**: Strong input validation (strings, UUIDs, IPFS hashes)
- **Error Handling**: Custom error types for clear debugging

### TypeScript Clients (ts-services/apps/)

- CLI-based interfaces using Commander.js
- Anchor TypeScript client libraries
- Environment-based configuration (devnet/localnet)

## Important Context

1. **Program IDs**: Defined in `rust-services/Anchor.toml`
   - Counter: `FWnVAF6MvNWPLQfSH4Moc2nfHCn5BYywnt5qWRofWeVc`
   - DoL: `B27nKPyjDEpBtEaKFjM9X3KA5nGJpBmH8YjcoQeKWLUi`

2. **State Seeds**: Program uses deterministic seeds for PDAs
   - DOL_STATE_SEED = "dol-state"
   - LIBRARY_CARD_SEED = "library-card"

3. **Validation Rules**:
   - Book titles: 1-100 chars
   - Authors: 1-50 chars
   - IPFS hashes: Must start with "Qm" and be 46 chars
   - UUIDs: Valid v4 format

4. **Testing**: Uses ts-mocha with Anchor's testing framework

## Development Workflow

1. Always run `anchor build` before testing
2. Use `--skip-local-validator` when validator is already running
3. Check program logs with `solana logs` for debugging
4. UUID duplicates are prevented at the program level
5. Program must be unpaused for most operations
