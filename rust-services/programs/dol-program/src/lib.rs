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

// Super Admin public key
pub const SUPER_ADMIN: &str = "AfuXGptXuHDGpnAL5V27fUkNkHTVcDPGgF1cGbmTena";

// Role limits
pub const MAX_ADMINS: usize = 3;
pub const MAX_MODERATORS: usize = 5;
pub const MAX_CURATORS: usize = 10;

// Role checking helper functions
impl DoLState {
    pub fn is_super_admin(&self, user: &Pubkey) -> bool {
        self.super_admin == *user
    }

    pub fn is_admin(&self, user: &Pubkey) -> bool {
        self.admins.contains(user)
    }

    pub fn is_moderator(&self, user: &Pubkey) -> bool {
        self.moderators.contains(user)
    }

    pub fn is_curator(&self, user: &Pubkey) -> bool {
        self.curators.contains(user)
    }

    pub fn has_admin_privileges(&self, user: &Pubkey) -> bool {
        self.is_super_admin(user) || self.is_admin(user)
    }

    pub fn can_add_books(&self, user: &Pubkey) -> bool {
        self.is_super_admin(user) || self.is_admin(user) || self.is_curator(user)
    }

    pub fn can_manage_roles(&self, user: &Pubkey) -> bool {
        self.is_super_admin(user) || self.is_admin(user)
    }

    pub fn is_paused(&self) -> bool {
        self.flags & 1 != 0
    }

    pub fn set_paused(&mut self, paused: bool) {
        if paused {
            self.flags |= 1;
        } else {
            self.flags &= !1;
        }
    }

    pub fn has_pending_transfer(&self) -> bool {
        self.pending_super_admin.is_some()
    }

    pub fn get_transfer_status(&self) -> (bool, Option<Pubkey>, i64, i64) {
        (
            self.has_pending_transfer(),
            self.pending_super_admin,
            self.transfer_initiated_at,
            self.transfer_timelock,
        )
    }

    pub fn get_emergency_recovery_status(&self) -> (bool, Option<Pubkey>, Vec<Pubkey>, u8) {
        (
            self.emergency_recovery_new_admin.is_some(),
            self.emergency_recovery_new_admin,
            self.emergency_recovery_votes.clone(),
            self.emergency_recovery_threshold,
        )
    }
}

// Enhanced validation helpers
fn validate_string_input(
    input: &str,
    min_len: usize,
    max_len: usize,
    field_name: &str,
) -> Result<()> {
    // Check length
    require!(
        input.len() >= min_len && input.len() <= max_len,
        match field_name {
            "title" => DoLError::TitleTooLong,
            "author" => DoLError::AuthorTooLong,
            "genre" => DoLError::GenreTooLong,
            _ => DoLError::InvalidBookId,
        }
    );

    // Check for non-printable characters and common injection patterns
    require!(
        input.chars().all(|c| c.is_ascii_graphic() || c == ' '),
        DoLError::InvalidInput
    );

    // Check for SQL injection patterns (basic protection)
    let dangerous_patterns = [
        "SELECT", "INSERT", "UPDATE", "DELETE", "DROP", "--", "/*", "*/", ";",
    ];
    let input_upper = input.to_uppercase();
    for pattern in dangerous_patterns.iter() {
        require!(!input_upper.contains(pattern), DoLError::InvalidInput);
    }

    Ok(())
}

fn validate_ipfs_hash_enhanced(hash: &str) -> Result<()> {
    // Basic IPFS validation
    require!(
        hash.len() >= 32 && (hash.starts_with("Qm") || hash.starts_with("baf")),
        DoLError::InvalidIpfsHash
    );

    // Check for valid base58 characters (for Qm hashes) or base32 (for baf hashes)
    if hash.starts_with("Qm") {
        require!(
            hash.chars()
                .all(|c| "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz".contains(c)),
            DoLError::InvalidIpfsHash
        );
    } else if hash.starts_with("baf") {
        require!(
            hash.chars().all(|c| c.is_ascii_alphanumeric()),
            DoLError::InvalidIpfsHash
        );
    }

    Ok(())
}

fn validate_uuid_v4(uuid: &[u8; 16]) -> Result<()> {
    // Check that UUID is not all zeros
    require!(uuid != &[0; 16], DoLError::InvalidBookId);

    // Check version bits (version 4 should have 0100 in bits 48-51)
    // This is the 7th byte (0-indexed byte 6), upper nibble should be 4
    let version_byte = uuid[6];
    let version = (version_byte >> 4) & 0x0F;
    require!(version == 4, DoLError::InvalidBookId);

    // Check variant bits (should be 10xx in bits 64-65)
    // This is the 9th byte (0-indexed byte 8), upper 2 bits should be 10
    let variant_byte = uuid[8];
    let variant = (variant_byte >> 6) & 0x03;
    require!(variant == 2, DoLError::InvalidBookId);

    Ok(())
}

fn validate_super_admin_address(
    new_super_admin: &Pubkey,
    current_super_admin: &Pubkey,
    dol_state: &DoLState,
) -> Result<()> {
    // Check if address is not default/zero
    require!(
        *new_super_admin != Pubkey::default(),
        DoLError::InvalidSuperAdmin
    );

    // Check if not transferring to self
    require!(
        *new_super_admin != *current_super_admin,
        DoLError::SelfTransferNotAllowed
    );

    // Prevent transfer to existing admin addresses to avoid conflicts
    require!(
        !dol_state.admins.contains(new_super_admin),
        DoLError::InvalidSuperAdmin
    );

    // Additional security: prevent transfer to system program addresses
    let system_program: Pubkey = anchor_lang::system_program::ID;
    require!(
        *new_super_admin != system_program,
        DoLError::InvalidSuperAdmin
    );

    Ok(())
}

#[program]
pub mod dol_program {
    use super::*;

    /// Initialize the DoL program with super admin authority (super admin only)
    /// This sets up the global state with role-based access control
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        // Validate that signer is the hardcoded super admin
        let super_admin_key: Pubkey = SUPER_ADMIN.parse::<Pubkey>().unwrap();
        require!(
            ctx.accounts.super_admin.key() == super_admin_key,
            DoLError::NotSuperAdmin
        );

        // If user is super admin, set up the global state with role-based access control and
        // initialize the program with default values
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        dol_state.super_admin = ctx.accounts.super_admin.key();
        dol_state.admins = Vec::new();
        dol_state.moderators = Vec::new();
        dol_state.curators = Vec::new();
        dol_state.book_count = 0;
        dol_state.version = 1;
        dol_state.flags = 0; // Start unpaused (bit 0 = 0)
        dol_state.bump = ctx.bumps.dol_state;
        // Initialize secure transfer fields
        dol_state.pending_super_admin = None;
        dol_state.transfer_initiated_at = 0;
        dol_state.transfer_timelock = 7 * 24 * 60 * 60; // 7 days in seconds
                                                        // Initialize emergency recovery fields
        dol_state.emergency_recovery_threshold = 2; // Require 2 admin signatures minimum
        dol_state.emergency_recovery_initiated_at = 0;
        dol_state.emergency_recovery_votes = Vec::new();
        dol_state.emergency_recovery_new_admin = None;

        msg!(
            "DoL program initialized with super admin: {:?}",
            dol_state.super_admin
        );
        Ok(())
    }

    /// Mint a free Library Card NFT that grants access to read all books
    /// Each user can only have one card (enforced by PDA seeds)
    pub fn mint_library_card(ctx: Context<MintLibraryCard>) -> Result<()> {
        // Create the library card
        let library_card: &mut Account<'_, LibraryCard> = &mut ctx.accounts.library_card;
        library_card.owner = ctx.accounts.user.key();
        library_card.mint_timestamp = Clock::get()?.unix_timestamp;
        library_card.bump = ctx.bumps.library_card;

        msg!("Library card minted for: {:?}", library_card.owner);
        Ok(())
    }

    /// Add a new book to the catalog (super admin, admin, or curator)
    /// Books are stored with metadata pointing to IPFS content
    /// The client must provide a unique UUID for the book ID
    pub fn add_book(
        ctx: Context<AddBook>,
        id: [u8; 16],
        title: String,
        author: String,
        ipfs_hash: String,
        genre: String,
    ) -> Result<()> {
        // Get the DoL state account
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        // Get the signer
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Check if program is paused
        require!(!dol_state.is_paused(), DoLError::ProgramPaused);

        // Check if user has permission to add books
        require!(
            dol_state.can_add_books(signer),
            DoLError::InsufficientPermissions
        );

        // Validate UUID v4 format
        validate_uuid_v4(&id)?;

        // Enhanced validation for all input fields
        validate_string_input(&title, 1, 100, "title")?;
        validate_string_input(&author, 1, 50, "author")?;
        validate_string_input(&genre, 1, 30, "genre")?;
        validate_ipfs_hash_enhanced(&ipfs_hash)?;

        // Get the book account
        let book: &mut Account<'_, Book> = &mut ctx.accounts.book;

        // Store book metadata with client-provided UUID
        book.id = id;
        book.title = title;
        book.author = author;
        book.ipfs_hash = ipfs_hash;
        book.genre = genre;
        book.publication_year = 0; // Optional field for future use
        book.added_timestamp = Clock::get()?.unix_timestamp;
        book.added_by = ctx.accounts.authority.key(); // Record who added the book
        book.bump = ctx.bumps.book;

        // Increment counter for analytics
        dol_state.book_count += 1;

        msg!(
            "Book added: {} by {} (ID: {:?}) by {:?}",
            book.title,
            book.author,
            &id[..4],
            signer
        );
        Ok(())
    }

    /// Update book metadata (super admin, admin, or curator)
    /// Any authorized user can update any book for collective maintenance
    pub fn update_book(
        ctx: Context<UpdateBook>,
        new_title: Option<String>,
        new_author: Option<String>,
        new_ipfs_hash: Option<String>,
        new_genre: Option<String>,
    ) -> Result<()> {
        // Get the DoL state account
        let dol_state: &Account<'_, DoLState> = &ctx.accounts.dol_state;
        // Get the signer
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Check if program is paused
        require!(!dol_state.is_paused(), DoLError::ProgramPaused);

        // Check if user has permission to update books
        require!(
            dol_state.can_add_books(signer), // Same permission as adding books
            DoLError::InsufficientPermissions
        );

        // Get the book account
        let book: &mut Account<'_, Book> = &mut ctx.accounts.book;

        // Update fields if provided with enhanced validation
        if let Some(title) = new_title {
            validate_string_input(&title, 1, 100, "title")?;
            book.title = title;
        }

        if let Some(author) = new_author {
            validate_string_input(&author, 1, 50, "author")?;
            book.author = author;
        }

        if let Some(ipfs_hash) = new_ipfs_hash {
            validate_ipfs_hash_enhanced(&ipfs_hash)?;
            book.ipfs_hash = ipfs_hash;
        }

        if let Some(genre) = new_genre {
            validate_string_input(&genre, 1, 30, "genre")?;
            book.genre = genre;
        }

        msg!(
            "Book updated: {} by {} (ID: {:?}) updated by {:?}",
            book.title,
            book.author,
            &book.id[..4],
            signer
        );
        Ok(())
    }

    /// Remove a book from the catalog (admin only)
    /// Only admins can remove books to prevent abuse
    pub fn remove_book(ctx: Context<RemoveBook>) -> Result<()> {
        // Get the DoL state account
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        // Get the signer
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Check if user has admin privileges (admins or super admin only)
        require!(
            dol_state.has_admin_privileges(signer),
            DoLError::InsufficientPermissions
        );

        // Get the book account
        let book: &Account<'_, Book> = &ctx.accounts.book;

        // Decrement book count
        dol_state.book_count = dol_state.book_count.saturating_sub(1);

        msg!(
            "Book removed: {} by {} (ID: {:?}) removed by {:?}",
            book.title,
            book.author,
            &book.id[..4],
            signer
        );

        // Note: The account will be automatically closed and rent refunded to the authority
        Ok(())
    }

    /// Retrieve book information (public access)
    /// Returns complete book details including audit trail
    pub fn get_book(ctx: Context<GetBook>) -> Result<()> {
        // Get the book account
        let book: &Account<'_, Book> = &ctx.accounts.book;

        // Print the book details
        msg!("Book Details:");
        msg!("- Title: {}", book.title);
        msg!("- Author: {}", book.author);
        msg!("- Genre: {}", book.genre);
        msg!("- IPFS Hash: {}", book.ipfs_hash);
        msg!(
            "- Publication Year: {}",
            if book.publication_year > 0 {
                book.publication_year.to_string()
            } else {
                "Unknown".to_string()
            }
        );
        msg!("- Added By: {:?}", book.added_by);
        msg!("- Added Timestamp: {}", book.added_timestamp);
        msg!("- Book ID: {:?}", &book.id[..8]); // Show first 8 bytes for identification

        Ok(())
    }

    /// Verify that a user has a valid library card for client access control
    pub fn verify_access(ctx: Context<VerifyAccess>) -> Result<()> {
        // Get the library card account
        let library_card: &Account<'_, LibraryCard> = &ctx.accounts.library_card;

        // Print the card holder
        msg!("Access verified for card holder: {:?}", library_card.owner);
        Ok(())
    }

    /// Add a new admin (super admin or admin only)
    pub fn add_admin(ctx: Context<ManageAdmin>, new_admin: Pubkey) -> Result<()> {
        // Get the DoL state account
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        // Get the signer
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Check if user has permission to manage roles
        require!(
            dol_state.can_manage_roles(signer),
            DoLError::InsufficientPermissions
        );

        // Check if admin limit is reached
        require!(
            dol_state.admins.len() < MAX_ADMINS,
            DoLError::AdminLimitReached
        );

        // Check if admin already exists
        require!(
            !dol_state.admins.contains(&new_admin),
            DoLError::AdminAlreadyExists
        );

        // Add the new admin
        dol_state.admins.push(new_admin);
        msg!("Admin added: {:?} by {:?}", new_admin, signer);
        Ok(())
    }

    /// Remove an admin (super admin only)
    pub fn remove_admin(ctx: Context<ManageAdmin>, admin_to_remove: Pubkey) -> Result<()> {
        // Get the DoL state account
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        // Get the signer
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Check if user has is super admin
        require!(dol_state.is_super_admin(signer), DoLError::OnlySuperAdmin);

        // Check if admin exists
        if let Some(pos) = dol_state.admins.iter().position(|&x| x == admin_to_remove) {
            // Remove the admin
            dol_state.admins.remove(pos);
            msg!("Admin removed: {:?} by super admin", admin_to_remove);
        } else {
            // Return error if admin not found
            return Err(DoLError::AdminNotFound.into());
        }

        Ok(())
    }

    /// Add a curator (super admin or admin only)
    pub fn add_curator(ctx: Context<ManageAdmin>, new_curator: Pubkey) -> Result<()> {
        // Get the DoL state account
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        // Get the signer
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Check if user has permission to manage roles
        require!(
            dol_state.can_manage_roles(signer),
            DoLError::InsufficientPermissions
        );

        // Check if curator limit is reached
        require!(
            dol_state.curators.len() < MAX_CURATORS,
            DoLError::CuratorLimitReached
        );

        // Check if curator already exists
        require!(
            !dol_state.curators.contains(&new_curator),
            DoLError::CuratorAlreadyExists
        );

        // Add the new curator
        dol_state.curators.push(new_curator);
        msg!("Curator added: {:?} by {:?}", new_curator, signer);
        Ok(())
    }

    /// Remove a curator (super admin or admin only)
    pub fn remove_curator(ctx: Context<ManageAdmin>, curator_to_remove: Pubkey) -> Result<()> {
        // Get the DoL state account
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        // Get the signer
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Check if user has permission to manage roles
        require!(
            dol_state.can_manage_roles(signer),
            DoLError::InsufficientPermissions
        );

        // Check if curator exists
        if let Some(pos) = dol_state
            .curators
            .iter()
            .position(|&x| x == curator_to_remove)
        {
            // Remove the curator
            dol_state.curators.remove(pos);
            msg!("Curator removed: {:?} by {:?}", curator_to_remove, signer);
        } else {
            // Return error if curator not found
            return Err(DoLError::CuratorNotFound.into());
        }

        Ok(())
    }

    /// Initiate super admin transfer (current super admin only)
    /// Step 1: Start the timelock period for security
    pub fn initiate_super_admin_transfer(
        ctx: Context<ManageAdmin>,
        new_super_admin: Pubkey,
    ) -> Result<()> {
        // Get the DoL state account
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        // Get the signer
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Check if user is super admin
        require!(dol_state.is_super_admin(signer), DoLError::OnlySuperAdmin);

        // Enhanced input validation
        validate_super_admin_address(&new_super_admin, &dol_state.super_admin, dol_state)?;

        // Check if there's already a pending transfer
        require!(
            dol_state.pending_super_admin.is_none(),
            DoLError::TransferAlreadyPending
        );

        // Initiate the transfer with timelock
        dol_state.pending_super_admin = Some(new_super_admin);
        dol_state.transfer_initiated_at = Clock::get()?.unix_timestamp;

        // Enhanced audit logging
        msg!("SECURITY_EVENT: Super admin transfer initiated");
        msg!("  - Initiated by: {:?}", signer);
        msg!("  - Current super admin: {:?}", dol_state.super_admin);
        msg!("  - Proposed new super admin: {:?}", new_super_admin);
        msg!(
            "  - Timelock period: {} seconds ({} days)",
            dol_state.transfer_timelock,
            dol_state.transfer_timelock / (24 * 60 * 60)
        );
        msg!(
            "  - Initiated at timestamp: {}",
            dol_state.transfer_initiated_at
        );
        msg!(
            "  - Can be confirmed after: {}",
            dol_state.transfer_initiated_at + dol_state.transfer_timelock
        );
        Ok(())
    }

    /// Confirm super admin transfer (current super admin only)
    /// Step 2: Complete the transfer after timelock period
    pub fn confirm_super_admin_transfer(ctx: Context<ManageAdmin>) -> Result<()> {
        // Get the DoL state account
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        // Get the signer
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Check if user is super admin
        require!(dol_state.is_super_admin(signer), DoLError::OnlySuperAdmin);

        // Check if there's a pending transfer
        require!(
            dol_state.pending_super_admin.is_some(),
            DoLError::NoPendingTransfer
        );

        // Check if timelock period has passed
        let current_time: i64 = Clock::get()?.unix_timestamp;
        let time_elapsed: i64 = current_time - dol_state.transfer_initiated_at;
        require!(
            time_elapsed >= dol_state.transfer_timelock,
            DoLError::TimelockNotExpired
        );

        // Complete the transfer
        let new_super_admin: Pubkey = dol_state.pending_super_admin.unwrap();
        let old_super_admin: Pubkey = dol_state.super_admin;

        dol_state.super_admin = new_super_admin;
        dol_state.pending_super_admin = None;
        dol_state.transfer_initiated_at = 0;

        // Enhanced audit logging
        msg!("SECURITY_EVENT: Super admin transfer completed");
        msg!("  - Confirmed by: {:?}", signer);
        msg!("  - Previous super admin: {:?}", old_super_admin);
        msg!("  - New super admin: {:?}", new_super_admin);
        msg!(
            "  - Transfer initiated at: {}",
            Clock::get()?.unix_timestamp - dol_state.transfer_timelock
        );
        msg!(
            "  - Transfer confirmed at: {}",
            Clock::get()?.unix_timestamp
        );
        msg!("  - Timelock period elapsed: {} seconds", time_elapsed);
        Ok(())
    }

    /// Cancel pending super admin transfer (current super admin only)
    /// Emergency cancellation of pending transfer
    pub fn cancel_super_admin_transfer(ctx: Context<ManageAdmin>) -> Result<()> {
        // Get the DoL state account
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        // Get the signer
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Check if user is super admin
        require!(dol_state.is_super_admin(signer), DoLError::OnlySuperAdmin);

        // Check if there's a pending transfer
        require!(
            dol_state.pending_super_admin.is_some(),
            DoLError::NoPendingTransfer
        );

        // Cancel the transfer
        let cancelled_transfer: Pubkey = dol_state.pending_super_admin.unwrap();
        dol_state.pending_super_admin = None;
        dol_state.transfer_initiated_at = 0;

        // Enhanced audit logging
        msg!("SECURITY_EVENT: Super admin transfer cancelled");
        msg!("  - Cancelled by: {:?}", signer);
        msg!("  - Cancelled transfer to: {:?}", cancelled_transfer);
        msg!(
            "  - Transfer was initiated at: {}",
            dol_state.transfer_initiated_at
        );
        msg!("  - Cancelled at: {}", Clock::get()?.unix_timestamp);
        Ok(())
    }

    /// Initiate emergency recovery (admin only)
    /// Used when super admin key is compromised or lost
    pub fn initiate_emergency_recovery(
        ctx: Context<ManageAdmin>,
        new_super_admin: Pubkey,
    ) -> Result<()> {
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Only admins can initiate emergency recovery
        require!(
            dol_state.is_admin(signer),
            DoLError::InsufficientPermissions
        );

        // Ensure there are enough admins for recovery
        require!(
            dol_state.admins.len() >= dol_state.emergency_recovery_threshold as usize,
            DoLError::InsufficientAdminsForRecovery
        );

        // Validate the proposed new super admin
        validate_super_admin_address(&new_super_admin, &dol_state.super_admin, dol_state)?;

        // Check if recovery is not already in progress
        require!(
            dol_state.emergency_recovery_new_admin.is_none(),
            DoLError::EmergencyRecoveryInProgress
        );

        // Initialize emergency recovery
        dol_state.emergency_recovery_new_admin = Some(new_super_admin);
        dol_state.emergency_recovery_initiated_at = Clock::get()?.unix_timestamp;
        dol_state.emergency_recovery_votes = vec![*signer]; // First vote

        // Enhanced audit logging
        msg!("SECURITY_EVENT: Emergency recovery initiated");
        msg!("  - Initiated by admin: {:?}", signer);
        msg!("  - Current super admin: {:?}", dol_state.super_admin);
        msg!("  - Proposed new super admin: {:?}", new_super_admin);
        msg!(
            "  - Votes required: {}",
            dol_state.emergency_recovery_threshold
        );
        msg!("  - Current votes: 1");
        msg!("  - Initiated at: {}", Clock::get()?.unix_timestamp);
        Ok(())
    }

    /// Vote for emergency recovery (admin only)
    pub fn vote_emergency_recovery(ctx: Context<ManageAdmin>) -> Result<()> {
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Only admins can vote
        require!(
            dol_state.is_admin(signer),
            DoLError::InsufficientPermissions
        );

        // Check if recovery is in progress
        require!(
            dol_state.emergency_recovery_new_admin.is_some(),
            DoLError::NoEmergencyRecoveryInProgress
        );

        // Check if admin has already voted
        require!(
            !dol_state.emergency_recovery_votes.contains(signer),
            DoLError::AlreadyVotedForRecovery
        );

        // Add vote
        dol_state.emergency_recovery_votes.push(*signer);

        // Enhanced audit logging for vote
        msg!("SECURITY_EVENT: Emergency recovery vote added");
        msg!("  - Vote by admin: {:?}", signer);
        msg!(
            "  - Total votes: {}/{}",
            dol_state.emergency_recovery_votes.len(),
            dol_state.emergency_recovery_threshold
        );
        msg!("  - Voters: {:?}", dol_state.emergency_recovery_votes);

        // Check if enough votes are collected
        if dol_state.emergency_recovery_votes.len()
            >= dol_state.emergency_recovery_threshold as usize
        {
            // Execute recovery
            let new_super_admin: Pubkey = dol_state.emergency_recovery_new_admin.unwrap();
            let old_super_admin: Pubkey = dol_state.super_admin;

            dol_state.super_admin = new_super_admin;

            // Clear recovery state
            dol_state.emergency_recovery_new_admin = None;
            dol_state.emergency_recovery_initiated_at = 0;
            dol_state.emergency_recovery_votes.clear();

            // Enhanced audit logging for execution
            msg!("SECURITY_EVENT: Emergency recovery executed");
            msg!("  - Previous super admin: {:?}", old_super_admin);
            msg!("  - New super admin: {:?}", new_super_admin);
            msg!(
                "  - Recovery initiated at: {}",
                dol_state.emergency_recovery_initiated_at
            );
            msg!("  - Recovery executed at: {}", Clock::get()?.unix_timestamp);
            msg!("  - Final vote by: {:?}", signer);
        }

        Ok(())
    }

    /// Cancel emergency recovery (super admin only)
    pub fn cancel_emergency_recovery(ctx: Context<ManageAdmin>) -> Result<()> {
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Only super admin can cancel recovery
        require!(dol_state.is_super_admin(signer), DoLError::OnlySuperAdmin);

        // Check if recovery is in progress
        require!(
            dol_state.emergency_recovery_new_admin.is_some(),
            DoLError::NoEmergencyRecoveryInProgress
        );

        // Clear recovery state
        let cancelled_recovery: Pubkey = dol_state.emergency_recovery_new_admin.unwrap();
        dol_state.emergency_recovery_new_admin = None;
        dol_state.emergency_recovery_initiated_at = 0;
        dol_state.emergency_recovery_votes.clear();

        // Enhanced audit logging
        msg!("SECURITY_EVENT: Emergency recovery cancelled");
        msg!("  - Cancelled by super admin: {:?}", signer);
        msg!("  - Cancelled recovery for: {:?}", cancelled_recovery);
        msg!(
            "  - Recovery was initiated at: {}",
            dol_state.emergency_recovery_initiated_at
        );
        msg!(
            "  - Votes collected: {}",
            dol_state.emergency_recovery_votes.len()
        );
        msg!("  - Cancelled at: {}", Clock::get()?.unix_timestamp);
        Ok(())
    }

    /// Pause program operations (super admin only)
    /// Emergency stop mechanism for security incidents
    pub fn pause_program(ctx: Context<ManageAdmin>) -> Result<()> {
        // Get the DoL state account
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        // Get the signer
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Check if user is super admin
        require!(dol_state.is_super_admin(signer), DoLError::OnlySuperAdmin);

        // Pause the program
        dol_state.set_paused(true);
        msg!("Program paused by super admin: {:?}", signer);
        Ok(())
    }

    /// Unpause program operations (super admin only)
    /// Resume normal operations after resolving issues
    pub fn unpause_program(ctx: Context<ManageAdmin>) -> Result<()> {
        // Get the DoL state account
        let dol_state: &mut Account<'_, DoLState> = &mut ctx.accounts.dol_state;
        // Get the signer
        let signer: &Pubkey = &ctx.accounts.authority.key();

        // Check if user is super admin
        require!(dol_state.is_super_admin(signer), DoLError::OnlySuperAdmin);

        // Unpause the program
        dol_state.set_paused(false);
        msg!("Program unpaused by super admin: {:?}", signer);
        Ok(())
    }
}

// Account structures
/// Global program state - tracks admin authorities and book catalog size
#[account]
pub struct DoLState {
    pub super_admin: Pubkey,     // Current super admin with full control
    pub admins: Vec<Pubkey>,     // Library admins (can add/remove books, manage roles)
    pub moderators: Vec<Pubkey>, // Moderators (can flag content, limited admin powers)
    pub curators: Vec<Pubkey>,   // Curators (can add books but not remove)
    pub book_count: u64,         // Total books added (for analytics and metrics)
    pub version: u8,             // Program version for future upgrades
    pub flags: u8,               // Bit flags: bit 0 = is_paused
    pub bump: u8,                // PDA bump seed
    // Super admin transfer security fields
    pub pending_super_admin: Option<Pubkey>, // Pending new super admin (if transfer initiated)
    pub transfer_initiated_at: i64,          // Timestamp when transfer was initiated
    pub transfer_timelock: i64, // Required delay before transfer can be confirmed (default: 7 days)
    // Emergency recovery fields
    pub emergency_recovery_threshold: u8, // Number of admin signatures required for emergency recovery
    pub emergency_recovery_initiated_at: i64, // Timestamp when emergency recovery was initiated
    pub emergency_recovery_votes: Vec<Pubkey>, // Admins who have voted for emergency recovery
    pub emergency_recovery_new_admin: Option<Pubkey>, // Proposed new super admin for recovery
    pub reserved: [u8; 4],                // Further reduced reserved space
}

/// Individual book record with metadata and IPFS content reference
#[account]
pub struct Book {
    pub id: [u8; 16],          // Unique book ID (UUID generated by client)
    pub title: String,         // Book title
    pub author: String,        // Author name
    pub ipfs_hash: String,     // IPFS hash pointing to book content
    pub genre: String,         // Book genre/category
    pub publication_year: u16, // Publication year (optional, 0 if unknown)
    pub added_timestamp: i64,  // When book was added to catalog
    pub added_by: Pubkey,      // Who added this book (for audit trail)
    pub bump: u8,              // PDA bump seed
    pub reserved: [u8; 32],    // Reserved space for future features
}

/// Library Card NFT that grants reading access to all books
#[account]
pub struct LibraryCard {
    pub owner: Pubkey,       // Card holder's wallet address
    pub mint_timestamp: i64, // When card was minted
    pub bump: u8,            // PDA bump seed
    pub reserved: [u8; 48],  // Reserved space for future features (increased)
}

// Context structures
/// Initialize the DoL program state account (super admin only)
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = super_admin,
        space = ANCHOR_DISCRIMINATOR + 32 + (4 + MAX_ADMINS * 32) + (4 + MAX_MODERATORS * 32) + (4 + MAX_CURATORS * 32) + 8 + 1 + 1 + 1 + (1 + 32) + 8 + 8 + 1 + 8 + (4 + MAX_ADMINS * 32) + (1 + 32) + 4,
        seeds = [b"dol_state"],              // Global singleton PDA
        bump
    )]
    pub dol_state: Account<'info, DoLState>,
    #[account(mut)]
    pub super_admin: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Mint a library card NFT for a user (one per wallet)
#[derive(Accounts)]
pub struct MintLibraryCard<'info> {
    #[account(
        init,
        payer = user,
        space = ANCHOR_DISCRIMINATOR + 32 + 8 + 1 + 48,  // Removed card_id, increased reserved
        seeds = [b"library_card", user.key().as_ref()],    // User-specific PDA
        bump
    )]
    pub library_card: Account<'info, LibraryCard>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Add a new book to the catalog (super admin, admin, or curator)
#[derive(Accounts)]
#[instruction(id: [u8; 16], title: String, author: String, ipfs_hash: String, genre: String)]
pub struct AddBook<'info> {
    #[account(
        mut,
        seeds = [b"dol_state"],
        bump = dol_state.bump
    )]
    pub dol_state: Account<'info, DoLState>,
    #[account(
        init,
        payer = authority,
        space = ANCHOR_DISCRIMINATOR + 16 + (4 + title.len()) + (4 + author.len()) + (4 + ipfs_hash.len()) + (4 + genre.len()) + 2 + 8 + 32 + 1 + 32,
        seeds = [b"book", id.as_ref()],     // UUID-based PDA addressing
        bump
    )]
    pub book: Account<'info, Book>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// Update book metadata (super admin, admin, or curator)
#[derive(Accounts)]
pub struct UpdateBook<'info> {
    #[account(
        seeds = [b"dol_state"],
        bump = dol_state.bump
    )]
    pub dol_state: Account<'info, DoLState>,
    #[account(mut)]
    pub book: Account<'info, Book>,
    pub authority: Signer<'info>,
}

/// Remove a book from catalog (admin only)
#[derive(Accounts)]
pub struct RemoveBook<'info> {
    #[account(
        mut,
        seeds = [b"dol_state"],
        bump = dol_state.bump
    )]
    pub dol_state: Account<'info, DoLState>,
    #[account(
        mut,
        close = authority
    )]
    pub book: Account<'info, Book>,
    #[account(mut)]
    pub authority: Signer<'info>,
}

/// Manage admin roles (super admin or admin can manage roles)
#[derive(Accounts)]
pub struct ManageAdmin<'info> {
    #[account(
        mut,
        seeds = [b"dol_state"],
        bump = dol_state.bump
    )]
    pub dol_state: Account<'info, DoLState>,
    #[account(mut)]
    pub authority: Signer<'info>,
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
    #[msg("Book ID must be a valid UUID v4")]
    InvalidBookId,
    #[msg("Book with this ID already exists")]
    BookAlreadyExists,
    // Role-based access control errors
    #[msg("Access denied: Only super admin can perform this action")]
    NotSuperAdmin,
    #[msg("Access denied: Only super admin can perform this action")]
    OnlySuperAdmin,
    #[msg("Access denied: Insufficient permissions for this action")]
    InsufficientPermissions,
    #[msg("Admin limit reached: Cannot add more admins")]
    AdminLimitReached,
    #[msg("Admin already exists")]
    AdminAlreadyExists,
    #[msg("Admin not found")]
    AdminNotFound,
    #[msg("Curator limit reached: Cannot add more curators")]
    CuratorLimitReached,
    #[msg("Curator already exists")]
    CuratorAlreadyExists,
    #[msg("Curator not found")]
    CuratorNotFound,
    #[msg("Moderator limit reached: Cannot add more moderators")]
    ModeratorLimitReached,
    #[msg("Moderator already exists")]
    ModeratorAlreadyExists,
    #[msg("Moderator not found")]
    ModeratorNotFound,
    #[msg("Program is currently paused by admin")]
    ProgramPaused,
    #[msg("Invalid input: contains forbidden characters or patterns")]
    InvalidInput,
    // Super admin transfer security errors
    #[msg("Invalid super admin address: cannot be zero address")]
    InvalidSuperAdmin,
    #[msg("Self-transfer not allowed: cannot transfer to current super admin")]
    SelfTransferNotAllowed,
    #[msg("Transfer already pending: cancel existing transfer first")]
    TransferAlreadyPending,
    #[msg("No pending transfer: initiate transfer first")]
    NoPendingTransfer,
    #[msg("Timelock not expired: transfer confirmation not yet available")]
    TimelockNotExpired,
    // Emergency recovery errors
    #[msg("Insufficient admins for emergency recovery")]
    InsufficientAdminsForRecovery,
    #[msg("Emergency recovery already in progress")]
    EmergencyRecoveryInProgress,
    #[msg("No emergency recovery in progress")]
    NoEmergencyRecoveryInProgress,
    #[msg("Admin has already voted for recovery")]
    AlreadyVotedForRecovery,
}
