# Decentralized Open Library (DoL)

A Web3 public good on Solana blockchain - a decentralized digital library where anyone can access free books and contribute to the catalog.

## What is DoL?

DoL creates a censorship-resistant digital library where:

- Anyone can mint a free "Library Card" NFT to access books
- Curators add books with content stored on IPFS
- All book metadata lives on-chain permanently
- Role-based permissions ensure quality control

## Quick Start

### Prerequisites

- Rust 1.75+
- Solana CLI 1.18+
- Anchor 0.30+
- Node.js & pnpm

### Setup

```bash
# Clone and install dependencies
git clone https://github.com/dol-org/dol.git
cd dol
pnpm install

# Start local Solana validator
solana-test-validator --reset

# Build and deploy (in new terminal)
cd rust-services
anchor build
anchor deploy
```

### Initialize DoL

```bash
# Initialize the program
cd ts-services/apps/dol-client
pnpm install
pnpm start initialize --keypair ~/.config/solana/id.json

# Mint your library card
pnpm start mint-card --keypair ~/.config/solana/id.json
```

## CLI Commands

All commands use: `pnpm start <command> --keypair <path>`

### User Commands

```bash
# Get library card
pnpm start mint-card --keypair ~/.config/solana/id.json

# Check program status
pnpm start status

# View book details
pnpm start get-book <book-id>

# View library card
pnpm start get-library-card <wallet-address>
```

### Curator Commands

```bash
# Add a book
pnpm start add-book --keypair ~/.config/solana/id.json \
  --title "Book Title" \
  --author "Author Name" \
  --ipfs "QmHashOfBookContent" \
  --genre "Fiction"

# Update book metadata
pnpm start update-book --keypair ~/.config/solana/id.json \
  --book-id <book-id> \
  --title "New Title" \
  --author "New Author"
```

### Admin Commands

```bash
# Initialize program (super admin only)
pnpm start initialize --keypair ~/.config/solana/id.json

# Add/remove admins
pnpm start add-admin --keypair ~/.config/solana/id.json --admin <pubkey>
pnpm start remove-admin --keypair ~/.config/solana/id.json --admin <pubkey>

# Add/remove curators
pnpm start add-curator --keypair ~/.config/solana/id.json --curator <pubkey>
pnpm start remove-curator --keypair ~/.config/solana/id.json --curator <pubkey>

# Remove books
pnpm start remove-book --keypair ~/.config/solana/id.json --book-id <book-id>

# Emergency controls
pnpm start pause-program --keypair ~/.config/solana/id.json
pnpm start unpause-program --keypair ~/.config/solana/id.json
```

### Security Commands

```bash
# Super admin transfer (7-day timelock)
pnpm start initiate-super-admin-transfer --keypair ~/.config/solana/id.json \
  --new-super-admin <pubkey>
pnpm start confirm-super-admin-transfer --keypair ~/.config/solana/id.json
pnpm start cancel-super-admin-transfer --keypair ~/.config/solana/id.json

# Emergency recovery (multi-admin)
pnpm start initiate-emergency-recovery --keypair ~/.config/solana/id.json \
  --new-super-admin <pubkey>
pnpm start vote-emergency-recovery --keypair ~/.config/solana/id.json
```

## Development

### Build & Test

```bash
# Build programs
cd rust-services
anchor build

# Run tests
anchor test --skip-local-validator

# Check code formatting
pnpm lint
pnpm lint:fix
```

### Deploy

```bash
# Deploy to local validator
anchor deploy

# Deploy to devnet
solana config set --url devnet
anchor deploy --provider.cluster devnet
```

### Debug

```bash
# Watch program logs
solana logs | grep "DoL"

# Check program status
pnpm start status
```

## Key Features

- **Free Access**: No fees to mint library cards or read books
- **Censorship Resistant**: Content stored on IPFS, metadata on-chain
- **Role-Based Security**: Super Admin → Admins → Curators → Users
- **Rate Limiting**: 50 books/day max, 60s cooldown between additions
- **Emergency Controls**: Program pause/unpause, admin recovery system
- **Timelock Security**: 7-day delay for super admin transfers

## Configuration

### Network Settings

- **Localnet**: Default for development
- **Devnet**: For testing with real SOL
- **Program ID**: `DoLotrsAZR2JYa4tjue2c5q4EYKMbm6kxcrvjbU5cxX5`

### File Structure

```
dol-practice/
├── rust-services/          # Solana programs
│   ├── programs/dol-program/   # Main library contract
│   └── tests/                  # Anchor tests
├── ts-services/            # TypeScript clients
│   └── apps/dol-client/        # CLI interface
└── docs/                   # Documentation
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Run tests: `anchor test`
4. Submit a pull request

## License

This project is a public good designed to provide permanent, censorship-resistant access to public domain literature.
