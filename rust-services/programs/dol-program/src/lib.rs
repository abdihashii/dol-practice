use anchor_lang::prelude::*;

declare_id!("DoLotrsAZR2JYa4tjue2c5q4EYKMbm6kxcrvjbU5cxX5");

pub const ANCHOR_DISCRIMINATOR: usize = 8;

#[program]
pub mod dol_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let dol_state = &mut ctx.accounts.dol_state;
        dol_state.admin = ctx.accounts.admin.key();
        dol_state.book_count = 0;
        dol_state.version = 1;
        dol_state.bump = ctx.bumps.dol_state;
        
        msg!("DoL program initialized with admin: {:?}", dol_state.admin);
        Ok(())
    }

    pub fn mint_library_card(ctx: Context<MintLibraryCard>) -> Result<()> {
        let library_card = &mut ctx.accounts.library_card;
        library_card.owner = ctx.accounts.user.key();
        library_card.card_id = Clock::get()?.unix_timestamp as u64;
        library_card.mint_timestamp = Clock::get()?.unix_timestamp;
        library_card.bump = ctx.bumps.library_card;
        
        msg!("Library card minted for: {:?}", library_card.owner);
        Ok(())
    }

    pub fn add_book(ctx: Context<AddBook>, title: String, author: String, ipfs_hash: String, genre: String) -> Result<()> {
        // Validation
        require!(!title.is_empty() && title.len() <= 100, DoLError::TitleTooLong);
        require!(!author.is_empty() && author.len() <= 50, DoLError::AuthorTooLong);
        require!(ipfs_hash.len() >= 32 && (ipfs_hash.starts_with("Qm") || ipfs_hash.starts_with("baf")), DoLError::InvalidIpfsHash);
        require!(!genre.is_empty() && genre.len() <= 30, DoLError::GenreTooLong);
        
        let dol_state = &mut ctx.accounts.dol_state;
        let book = &mut ctx.accounts.book;
        
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

    pub fn get_book(ctx: Context<GetBook>) -> Result<()> {
        let book = &ctx.accounts.book;
        msg!("Book: {} by {} - IPFS: {}", book.title, book.author, book.ipfs_hash);
        Ok(())
    }

    pub fn verify_access(ctx: Context<VerifyAccess>) -> Result<()> {
        let library_card = &ctx.accounts.library_card;
        msg!("Access verified for card holder: {:?}", library_card.owner);
        Ok(())
    }
}

// Account structures
#[account]
pub struct DoLState {
    pub admin: Pubkey,
    pub book_count: u64,
    pub version: u8,
    pub bump: u8,
    pub reserved: [u8; 64], // Reserved space for future features
}

#[account]
pub struct Book {
    pub id: u64,
    pub title: String,
    pub author: String,
    pub ipfs_hash: String,
    pub genre: String,
    pub publication_year: u16,
    pub added_timestamp: i64,
    pub bump: u8,
    pub reserved: [u8; 32], // Reserved space for future features
}

#[account]
pub struct LibraryCard {
    pub owner: Pubkey,
    pub card_id: u64,
    pub mint_timestamp: i64,
    pub bump: u8,
    pub reserved: [u8; 32], // Reserved space for future features
}

// Context structures
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = ANCHOR_DISCRIMINATOR + 32 + 8 + 1 + 1 + 64,
        seeds = [b"dol_state"],
        bump
    )]
    pub dol_state: Account<'info, DoLState>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintLibraryCard<'info> {
    #[account(
        init,
        payer = user,
        space = ANCHOR_DISCRIMINATOR + 32 + 8 + 8 + 1 + 32,
        seeds = [b"library_card", user.key().as_ref()],
        bump
    )]
    pub library_card: Account<'info, LibraryCard>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(title: String, author: String, ipfs_hash: String, genre: String)]
pub struct AddBook<'info> {
    #[account(
        mut,
        has_one = admin,
        seeds = [b"dol_state"],
        bump = dol_state.bump
    )]
    pub dol_state: Account<'info, DoLState>,
    #[account(
        init,
        payer = admin,
        space = ANCHOR_DISCRIMINATOR + 8 + (4 + title.len()) + (4 + author.len()) + (4 + ipfs_hash.len()) + (4 + genre.len()) + 2 + 8 + 1 + 32,
        seeds = [b"book", dol_state.book_count.to_le_bytes().as_ref()],
        bump
    )]
    pub book: Account<'info, Book>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct GetBook<'info> {
    pub book: Account<'info, Book>,
}

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
