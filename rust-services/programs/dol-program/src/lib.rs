//! # Decentralized Open Library (DoL) Program
//! 
//! A Solana program for managing a decentralized digital library where:
//! - Anyone can mint a free "Library Card" NFT to access the catalog
//! - Admins curate books with metadata pointing to IPFS-stored content
//! - All book metadata and user access records are stored on-chain
//! - Future extensibility for collections, annotations, and community features

use anchor_lang::prelude::*;

declare_id!("DoLotrsAZR2JYa4tjue2c5q4EYKMbm6kxcrvjbU5cxX5");

pub const ANCHOR_DISCRIMINATOR: usize = 8;

#[program]
pub mod dol_program {
    use super::*;

    /// Initialize the DoL program with an admin authority
    /// This sets up the global state and designates who can add books to the catalog
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        dol_state.admin = ctx.accounts.admin.key();
        dol_state.book_count = 0;
        dol_state.version = 1;
        dol_state.bump = ctx.bumps.dol_state;
        
        msg!("DoL program initialized with admin: {:?}", dol_state.admin);
        Ok(())
    }

    /// Mint a free Library Card NFT that grants access to read all books
    /// Each user can only have one card (enforced by PDA seeds)
    pub fn mint_library_card(ctx: Context<MintLibraryCard>) -> Result<()> {
        let library_card: &mut Account<'_, LibraryCard> = &mut ctx.accounts.library_card;
        library_card.owner = ctx.accounts.user.key();
        library_card.card_id = Clock::get()?.unix_timestamp as u64;
        library_card.mint_timestamp = Clock::get()?.unix_timestamp;
        library_card.bump = ctx.bumps.library_card;
        
        msg!("Library card minted for: {:?}", library_card.owner);
        Ok(())
    }

    /// Add a new book to the catalog (admin only)
    /// Books are stored with metadata pointing to IPFS content
    pub fn add_book(ctx: Context<AddBook>, title: String, author: String, ipfs_hash: String, genre: String) -> Result<()> {
        // Validate all input fields for content and length constraints
        require!(!title.is_empty() && title.len() <= 100, DoLError::TitleTooLong);
        require!(!author.is_empty() && author.len() <= 50, DoLError::AuthorTooLong);
        require!(ipfs_hash.len() >= 32 && (ipfs_hash.starts_with("Qm") || ipfs_hash.starts_with("baf")), DoLError::InvalidIpfsHash);
        require!(!genre.is_empty() && genre.len() <= 30, DoLError::GenreTooLong);
        
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        let book: &mut Account<'_, Book> = &mut ctx.accounts.book;
        
        // Assign sequential ID and store book metadata
        book.id = dol_state.book_count;
        book.title = title;
        book.author = author;
        book.ipfs_hash = ipfs_hash;
        book.genre = genre;
        book.publication_year = 0; // Optional field for future use
        book.added_timestamp = Clock::get()?.unix_timestamp;
        book.bump = ctx.bumps.book;
        
        dol_state.book_count += 1;
        
        msg!("Book added: {} by {}", book.title, book.author);
        Ok(())
    }

    /// Retrieve book information (public access)
    pub fn get_book(ctx: Context<GetBook>) -> Result<()> {
        let book: &Account<'_, Book> = &ctx.accounts.book;
        msg!("Book: {} by {} - IPFS: {}", book.title, book.author, book.ipfs_hash);
        Ok(())
    }

    /// Verify that a user has a valid library card for client access control
    pub fn verify_access(ctx: Context<VerifyAccess>) -> Result<()> {
        let library_card: &Account<'_, LibraryCard> = &ctx.accounts.library_card;
        msg!("Access verified for card holder: {:?}", library_card.owner);
        Ok(())
    }
}

// Account structures
/// Global program state - tracks admin authority and book catalog size
#[account]
pub struct DoLState {
    pub admin: Pubkey,              // Who can add books to the catalog
    pub book_count: u64,            // Total books added (used for sequential IDs)
    pub version: u8,                // Program version for future upgrades
    pub bump: u8,                   // PDA bump seed
    pub reserved: [u8; 64],         // Reserved space for future features
}

/// Individual book record with metadata and IPFS content reference
#[account]
pub struct Book {
    pub id: u64,                    // Sequential book ID
    pub title: String,              // Book title
    pub author: String,             // Author name
    pub ipfs_hash: String,          // IPFS hash pointing to book content
    pub genre: String,              // Book genre/category
    pub publication_year: u16,      // Publication year (optional, 0 if unknown)
    pub added_timestamp: i64,       // When book was added to catalog
    pub bump: u8,                   // PDA bump seed
    pub reserved: [u8; 32],         // Reserved space for future features
}

/// Library Card NFT that grants reading access to all books
#[account]
pub struct LibraryCard {
    pub owner: Pubkey,              // Card holder's wallet address
    pub card_id: u64,               // Unique card identifier
    pub mint_timestamp: i64,        // When card was minted
    pub bump: u8,                   // PDA bump seed
    pub reserved: [u8; 32],         // Reserved space for future features
}

// Context structures
/// Initialize the DoL program state account
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = ANCHOR_DISCRIMINATOR + 32 + 8 + 1 + 1 + 64,
        seeds = [b"dol_state"],              // Global singleton PDA
        bump
    )]
    pub dol_state: Account<'info, DoLState>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Mint a library card NFT for a user (one per wallet)
#[derive(Accounts)]
pub struct MintLibraryCard<'info> {
    #[account(
        init,
        payer = user,
        space = ANCHOR_DISCRIMINATOR + 32 + 8 + 8 + 1 + 32,
        seeds = [b"library_card", user.key().as_ref()],    // User-specific PDA
        bump
    )]
    pub library_card: Account<'info, LibraryCard>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Add a new book to the catalog (admin only)
#[derive(Accounts)]
#[instruction(title: String, author: String, ipfs_hash: String, genre: String)]
pub struct AddBook<'info> {
    #[account(
        mut,
        has_one = admin,                    // Ensures only the designated admin can add books
        seeds = [b"dol_state"],
        bump = dol_state.bump
    )]
    pub dol_state: Account<'info, DoLState>,
    #[account(
        init,
        payer = admin,
        space = ANCHOR_DISCRIMINATOR + 8 + (4 + title.len()) + (4 + author.len()) + (4 + ipfs_hash.len()) + (4 + genre.len()) + 2 + 8 + 1 + 32,
        seeds = [b"book", dol_state.book_count.to_le_bytes().as_ref()],    // Sequential book IDs
        bump
    )]
    pub book: Account<'info, Book>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Read book information (public access)
#[derive(Accounts)]
pub struct GetBook<'info> {
    pub book: Account<'info, Book>,
}

/// Verify library card ownership for client access control
#[derive(Accounts)]
pub struct VerifyAccess<'info> {
    pub library_card: Account<'info, LibraryCard>,
}

// Custom error types
#[error_code]
pub enum DoLError {
    #[msg("Unauthorized: Only admin can perform this action")]
    Unauthorized,
    #[msg("Book title invalid (1-100 characters required)")]
    TitleTooLong,
    #[msg("Author name invalid (1-50 characters required)")]
    AuthorTooLong,
    #[msg("IPFS hash invalid format (must be valid IPFS hash starting with Qm or baf)")]
    InvalidIpfsHash,
    #[msg("Genre invalid (1-30 characters required)")]
    GenreTooLong,
    #[msg("Library card already exists for this user")]
    CardAlreadyExists,
}
