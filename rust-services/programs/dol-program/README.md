# Decentralized Open Library (DoL) Program

A Solana smart contract for managing a decentralized digital library with on-chain metadata and IPFS content storage.

## Overview

The DoL program enables:

- **Free Library Cards**: Users mint NFTs for library access (no UUID required)
- **Decentralized Book Catalog**: On-chain metadata with IPFS content links
- **Role-Based Access Control**: Super admin, admins, and curators
- **UUID v4 Validation**: Ensures unique book identifiers
- **Program Controls**: Pause/unpause functionality for emergencies

## Architecture

### Account Structures

#### DoLState (Global Program State)

```rust
pub struct DoLState {
    pub super_admin: Pubkey,        // Hardcoded super admin
    pub admins: Vec<Pubkey>,        // Can add/remove books, manage roles
    pub moderators: Vec<Pubkey>,    // Reserved for future use
    pub curators: Vec<Pubkey>,      // Can add books only
    pub book_count: u64,            // Total books in catalog
    pub version: u8,                // Program version
    pub flags: u8,                  // Bit 0: is_paused
    pub bump: u8,                   // PDA bump seed
}
```

#### LibraryCard (User Access NFT)

```rust
pub struct LibraryCard {
    pub owner: Pubkey,          // Card holder's wallet
    pub mint_timestamp: i64,    // When card was minted
    pub bump: u8,               // PDA bump seed
}
```

#### Book (Catalog Entry)

```rust
pub struct Book {
    pub id: [u8; 16],          // UUID v4 (validated)
    pub title: String,         // Max 100 chars
    pub author: String,        // Max 50 chars
    pub ipfs_hash: String,     // IPFS CID (v0 or v1)
    pub genre: String,         // Max 30 chars
    pub publication_year: u16, // Optional
    pub added_timestamp: i64,  // When added
    pub added_by: Pubkey,      // Who added it
    pub bump: u8,              // PDA bump seed
}
```

### Program Instructions

| Instruction         | Authority         | Description                      |
| ------------------- | ----------------- | -------------------------------- |
| `initialize`        | Super Admin       | One-time program setup           |
| `mint_library_card` | Any User          | Mint access NFT (one per wallet) |
| `add_book`          | Admin/Curator     | Add book with UUID validation    |
| `update_book`       | Admin/Curator     | Update book metadata             |
| `remove_book`       | Admin Only        | Remove book from catalog         |
| `get_book`          | Public            | Read book information            |
| `verify_access`     | Public            | Verify library card ownership    |
| `add_admin`         | Super Admin/Admin | Add new admin                    |
| `remove_admin`      | Super Admin       | Remove admin                     |
| `add_curator`       | Admin             | Add curator                      |
| `remove_curator`    | Admin             | Remove curator                   |
| `pause_program`     | Super Admin       | Emergency pause                  |
| `unpause_program`   | Super Admin       | Resume operations                |

### PDA Derivations

```rust
// Global state (singleton)
[b"dol_state"]

// Library card (one per user)
[b"library_card", user_pubkey]

// Book (by UUID)
[b"book", book_uuid_bytes]
```

## Recent Improvements

### UUID Optimization (June 2025)

- **Removed UUID Registry**: Library cards no longer need UUIDs
- **Storage Reduction**: ~75% smaller DoLState account
- **Unlimited Scalability**: No limit on library cards
- **UUID v4 Validation**: Books must use proper UUID v4 format

### Storage Costs

- **DoLState**: ~500 bytes (was ~20KB with UUID registry)
- **LibraryCard**: ~90 bytes per user
- **Book**: ~200-250 bytes depending on metadata

## Security Features

### Input Validation

- **String Validation**: Prevents injection attacks
- **IPFS Hash Validation**: Ensures valid CIDv0/CIDv1 format
- **UUID v4 Validation**: Checks version and variant bits
- **Length Limits**: Prevents oversized transactions

### Access Control

```rust
// Role hierarchy
Super Admin > Admin > Curator > User

// Permissions
- Super Admin: Full control, transfer role
- Admin: Manage books and curators
- Curator: Add books only
- User: Read access with library card
```

### Error Handling

Key error codes:

- `InvalidBookId`: UUID validation failed
- `InsufficientPermissions`: Role check failed
- `ProgramPaused`: Operations blocked
- `InvalidInput`: Validation failed

## Quick Start

### Prerequisites

- Rust 1.75+
- Solana CLI 1.18+
- Anchor 0.30+

### Build

```bash
anchor build
```

### Test

```bash
anchor test
```

### Deploy

```bash
# Local
anchor deploy

# Devnet
anchor deploy --provider.cluster devnet
```

## Configuration

### Program ID

Update in `Anchor.toml`:

```toml
[programs.localnet]
dol_program = "DoLotrsAZR2JYa4tjue2c5q4EYKMbm6kxcrvjbU5cxX5"
```

### Super Admin

Hardcoded in `lib.rs`:

```rust
pub const SUPER_ADMIN: &str = "AfuXGptXuHDGpnAL5V27fUkNkHTVcDPGgF1cGbmTena";
```

## Testing

See the comprehensive [DoL Program Testing Guide](../../../docs/DOL_PROGRAM_TESTING_GUIDE.md) for:

- Local testnet setup
- Devnet deployment
- Test scenarios
- Troubleshooting

## Future Enhancements

Planned features:

- User collections and bookshelves
- Reading progress tracking
- Community reviews and ratings
- Annotation system
- DAO governance transition

## License

This program is part of the Decentralized Open Library project, designed to provide permanent, censorship-resistant access to public domain literature.
