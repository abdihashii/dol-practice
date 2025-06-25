# Product Requirements Document: Decentralized Open Library (DOL)

Version: 0.2
Created: May 5, 2025
Updated: June 17, 2025
Status: Draft

## 1. Introduction / Overview

The Decentralized Open Library (DOL) is a platform designed to provide persistent, user-owned access to a vast collection of free, open-access digital books (e.g., public domain works, Creative Commons licensed materials). It leverages decentralized storage (IPFS, with a goal of permanent storage on Arweave) for the actual book content and the Solana blockchain for managing metadata, user collections, and enabling a rich, interactive user experience layer. DOL aims to be more than just a static repository; it intends to be a living, interactive digital library potentially owned and curated by its community, showcasing the power of Web3 for public good beyond financial applications.

## 2. Motivation / Problem Statement

- **Ephemeral & Centralized Access:** Current access to free digital literature is often scattered across various websites and platforms. These are typically centralized, creating single points of failure, potential censorship risks, and vendor lock-in. Data associated with user activity (collections, notes) resides on company servers and can be lost.
- **Lack of True Ownership & Portability:** Users interacting with traditional digital libraries don't truly "own" their collection records or associated interaction data (notes, reading status, highlights). This data is siloed within the platform and cannot be easily moved or utilized elsewhere.
- **Passive Consumption Experience:** Many digital reading platforms offer a relatively passive experience. Opportunities for deep personalization, meaningful interaction (beyond simple bookmarks), and community engagement around free texts are often limited, especially in a way that respects user ownership and decentralization.
- **Untapped Web3 Potential for Public Goods:** There's a significant opportunity to apply the principles of blockchain (ownership, transparency, composability) and decentralized storage (resilience, censorship resistance) to create a more robust, permanent, user-centric, and interactive public good focused on open knowledge access.

## 3. Vision

To build the world's most accessible, permanent, and interactive digital public library, where access to open knowledge is resilient and user engagement is rich, seamless, and truly owned by the individual. We envision a future where reading free digital books is enhanced by a layer of verifiable ownership, portable data, and community interaction, all powered by efficient decentralized technologies.

## 4. Goals

- **Provide Resilient Access:** Offer a robust, scalable interface to discover and access a large, well-organized corpus of open-access digital books stored permanently on decentralized infrastructure.
- **Enable Rich User Experience:** Facilitate seamless user interactions for collecting, organizing (e.g., reading status, custom tags/shelves), annotating, and potentially reviewing books. These interactions should feel instantaneous and frictionless, leveraging Solana's speed and low cost.
- **Establish True Digital Ownership:** Empower users with verifiable, portable ownership of their library collection records and associated interaction data (notes, statuses, highlights), tied directly to their decentralized identity (wallet).
- **Showcase Practical Web3 Utility:** Demonstrate a compelling, non-financial, public-good use case for blockchain technology (specifically Solana) and decentralized storage, highlighting benefits beyond speculation.
- **Foster Optional Community Engagement:** Create pathways for users to optionally share insights, contribute to curation (e.g., public lists, shared tags), and engage around shared literary interests in a transparent, decentralized manner.

## 5. User Access & Curation Model

### 5.1. The Library Card NFT

Access to the library's reading interface is granted via a "Library Card" NFT.

- **Universal Access:** The Library Card will be open for anyone to acquire.
- **Minting Model:** The NFT itself is free, but the user is responsible for paying the minimal on-chain transaction fee (the "minting fee") on the Solana network. This ensures broad accessibility while covering the network cost of issuance.

### 5.2. Content Curation

- **Initial Curation (Launch Phase):** To ensure a high-quality and legally compliant initial catalog, books will only be added by a core team of designated administrators. This prevents spam and allows for careful vetting of public domain sources.
- **Future Governance (DAO Model):** The long-term vision is to transition control over content curation and platform governance to a Decentralized Autonomous Organization (DAO). Library Card holders may eventually participate in voting on which new books to add, content policies, and other platform decisions.

## 6. Technical Architecture

### 6.1. The Hybrid On-Chain/Off-Chain Model

The DOL's architecture is designed to leverage the distinct strengths of the blockchain and decentralized storage networks.

- **Blockchain Layer (Solana):** Used as a high-performance database and logic layer. It will manage all dynamic data, metadata, ownership records, and user interactions.
- **Storage Layer (Arweave/IPFS):** Used for storing the static, larger book content files. The primary goal is to use **Arweave** for its pay-once, store-forever model, which guarantees the permanence of the library's collection.

### 6.2. The Solana Program (Smart Contract)

The on-chain program is the core logic of the library

- **Metadata Structure:** The program will define an on-chain data structure for each book, storing essential metadata like title, author, genre, and - most importantly - a URI pointing to the full book file on the storage layer.
- **Program Derived Addresses (PDAs):** Each book's metadata will be stored in a unique PDA, making it easily discoverable and manageable on-chain.
- **Key Instructions:** The program will include functions (instructions) for:
  - `add_book`: Called by admins to add new books to the catalog.
  - `update_metadata`: To correct or enrich existing metadata.
  - User-facing instructions for personal collection management (e.g., `add_to_shelf`, `update_status`)

### 6.3. The Web Application (dApp)

- **Frontend Interface:** A user-friendly web application will serve as the primary portal to the library. It will handle wallet connections, verify Library Card NFTs, display the book catalog, and provide an integrated reading experience.
- **Decentralized Hosting:** To maximize censorship resistance, the frontend application itself will be hosted on a decentralized service (e.g., IPFS, Arweave), ensuring that the access point is as resilient as the data it serves.
- **Indexing:** For a fast and response search/browse experience, an off-chain indexing service will be used to aggregate and cache the on-chain metadata, providing a rapid API for the frontend to query.

## 7. Use Cases / User Stories

- **Effortless Collection:** A user browsing classic literature finds "The Count of Monte Cristo" on DOL and instantly adds it to their personal, permanent on-chain collection with a single click, feeling immediate confirmation.
- **Dynamic Organization:** A reader manages their collection by fluidly moving books between custom shelves like "Currently Reading," "Completed," "To Read," or thematic shelves like "Sci-Fi Classics," with these changes reflected instantly and stored reliably.
- **Integrated Annotation:** While reading a collected philosophy text, a user highlights a passage and adds a private note. This annotation is linked to their ownership record and stored decentrally (potentially encrypted on IPFS or Arweave, linked via the on-chain record), accessible whenever they view the book via their wallet.
- **Community Discovery:** Before diving into a complex work, a user checks aggregated community tags or optionally shared public reading lists featuring that book to find related works or gain context, trusting the data's on-chain linkage.
- **Portable Library Access:** A user logs into a new device or potentially a different future front-end interface compatible with DOL's on-chain standard. By connecting their Solana wallet, their entire collection, shelves, statuses, and notes are immediately available.
- **Verifiable Reading History (Optional):** A user might choose to generate a verifiable, on-chain proof of books they have marked as "Completed," potentially for use in other integrated educational or social applications (requires careful privacy consideration).

## 8. Target Audience

- General readers seeking access to classic literature, public domain works, and other free digital books.
- Students, educators, and researchers who utilize open-access texts for learning and scholarship.
- Web3 natives and enthusiasts looking for practical, non-speculative applications of decentralized technology.
- Individuals interested in data ownership, privacy, and censorship resistance in their digital lives.
- Communities focused on preserving and promoting access to open knowledge.

## 9. Sustainable Funding Strategy

### 9.1. Guiding Philosophy

The DOL will operate on a non-profit, public good model. The strategy is designed to cover operational costs (storage, on-chain fees, maintenance) without compromising the core mission through intrusive ads or pay-walling essential reading features.

### 9.2. Phase 1: Foundation Funding (Launch)

- **Primary Goal:** Secure initial capital to cover development, deployment, and initial content storage costs.
- **Methods:**
  - **Grant Applications:** Actively seek funding from organization like Solana Foundation, Gitcoin, and other Web3 public good grant programs.
  - **Donations:** Establish a transparent, public donation address that will seed the future DAO treasury.

### 9.3. Phase 2: Community-Driven Sustenance (Growth)

- **Primary Goal:** Building recurring, non-intrusive revenue streams from an engaged user base.
- **Methods:**
  - **'Supporter" Library Cards:** Offer special edition, cosmetic NFTs for a donation. These provide no extra access but act as a collectible and a signal of support.
  - **Value-Add Feature Fees:** Charge a nominal, one-time fee for non-essential, power-user features, such as publishing a permanent, public "Curated Reading List."

### 9.4. Phase 3: Long-Term Ecosystem (Maturity)

- **Primary Goal:** Achieve long-term self-sufficiency managed by the DAO.
- **Methods:**
  - **DAO Treasury Management:** The DAO will manage the treasury, potentially using a portion of funds in a low-risk staking or DeFi protocols to generate perpetual yield to cover operational costs.
  - **Strategic Partnerships:** Collaborate with educational institutions or cultural organizations who many fund the inclusion of specific collections.

## 10. Significance for Blockchain / Web3

- **Public Good Utility:** Provides a tangible example of blockchain technology serving cultural preservation, education, and information access, moving beyond purely financial applications.
- **Highlighting Solana's UX Advantage:** Demonstrates how Solana's high throughput and extremely low transaction fees are crucial for enabling a "rich UX" involving frequent, low-stakes on-chain interactions (collecting, status updates, tagging, micro-annotations) that would be impractical or costly on many other blockchains. This makes complex decentralized applications feel smooth and responsive like Web2 apps.
- **Synergy with Decentralized Storage:** Effectively utilizes IPFS for its core strength – resilient, content-addressed storage of larger data blobs (the books themselves), while keeping the dynamic metadata and interaction logic on the fast blockchain layer.
- **Composability & Ownership:** Creates genuinely owned digital objects (library records, annotations, curated lists) tied to user wallets. This opens possibilities for future interoperability and composability with other Web3 identity, social graph, or decentralized science (DeSci) protocols.
- **Enhanced Censorship Resistance:** By decentralizing both the content storage and the catalog/interaction layer, the library as a whole becomes significantly more resistant to single points of failure, takedowns, or censorship compared to traditional centralized platforms.

## 11. Phased Roadmap (Conceptual)

- **Phase 1 (Launch):**
  - Deploy core Solana program for book metadata.
  - Establish admin-controlled curation.
  - Launch the dApp with basic browse/read functionality.
  - Implement the "Library Card NFT" mint
  - Secure foundation grant funding
- **Phase 2 (Growth):**
  - Introduce rich UX features (shelves, statuses)
  - Implement value-add monetization (supporter NFTs, paid lists).
  - Begin forming the DAO structure and governance framework.
- **Phase 3 (Maturity):**
  - Transfer control of the program and treasury to the DAO.
  - Explore community-led curation proposals.
  - Focus on long-term treasury management and ecosystem partnerships.

## 12. Key Features (Conceptual High-Level)

- Decentralized Book Catalog (Metadata, IPFS Links, managed via Solana Program)
- User-Owned Collections (On-chain records mapping wallets to book identifiers)
- Dynamic Reading Status & Custom Shelving/Tagging System
- Personal Annotation Layer (Linked to ownership, potentially stored decentrally)
- Optional Community Curation Tools (e.g., Public Lists, Shared Tags)
- Optional Review & Rating System (Aggregated, linked on-chain)
- Robust Search & Filtering (Leveraging on-chain data and potentially indexers)
- Seamless Solana Wallet Integration (Phantom, Solflare, Backpack, etc.)
- Markdown Reader Interface
