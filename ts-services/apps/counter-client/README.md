# Solana TypeScript Client

A TypeScript client for interacting with the DOL Program deployed on Solana devnet using raw web3.js (no Anchor client dependencies).

## Program Address

```
89oT3JtfnGATv6hTyzt3fD3y95JNrmEzDRRMYrJ8X53R
```

## Usage

⚠️ **Important**: A keypair file is **required** for all operations except `get` (initialize, increment, decrement, my-counter commands).

### Show Help

```bash
pnpm start
```

### Initialize a New Counter

```bash
pnpm start initialize --keypair /path/to/your/keypair.json
```

This will:

- Create your unique counter PDA (Program Derived Address)
- Set the caller as the authority
- Initialize count to 0
- Output the counter PDA address

### Increment Your Counter

```bash
pnpm start increment --keypair /path/to/your/keypair.json
```

This will:

- Increment your counter by 1
- Output the transaction signature

### Decrement Your Counter

```bash
pnpm start decrement --keypair /path/to/your/keypair.json
```

This will:

- Decrement your counter by 1
- Output the transaction signature

### Get Counter Value

```bash
pnpm start get <counter_address>
```

This will display:

- Counter address
- Authority (owner) public key
- Current count value

### Get Your Counter

```bash
pnpm start my-counter --keypair /path/to/your/keypair.json
```

This will:

- Calculate your counter PDA address
- Display the PDA address
- Show your counter's current value

## Keypair Requirements

### Mandatory Keypair

- **Initialize**: Requires `--keypair <path>` to create and fund new PDA accounts
- **Increment**: Requires `--keypair <path>` to increment your counter
- **Decrement**: Requires `--keypair <path>` to decrement your counter
- **Get**: No keypair needed (read-only operation)
- **My Counter**: Requires `--keypair <path>` to derive your PDA address

### Keypair Format

The keypair file should be a JSON array of 64 numbers (the secret key bytes):

```json
[123,45,67,89,...]
```

## Example Workflow

1. **Initialize your counter:**

   ```bash
   pnpm start initialize --keypair /path/to/your/keypair.json
   # Output: Counter address: <your-unique-PDA-address>
   ```

2. **Check your counter:**

   ```bash
   pnpm start my-counter --keypair /path/to/your/keypair.json
   # Output: Your counter PDA: <your-PDA-address>
   # Output: Count: 0
   ```

3. **Increment your counter:**

   ```bash
   pnpm start increment --keypair /path/to/your/keypair.json
   ```

4. **Check updated value:**

   ```bash
   pnpm start my-counter --keypair /path/to/your/keypair.json
   # Output: Count: 1
   ```

5. **Decrement your counter:**

   ```bash
   pnpm start decrement --keypair /path/to/your/keypair.json
   ```

6. **Check final value:**
   ```bash
   pnpm start my-counter --keypair /path/to/your/keypair.json
   # Output: Count: 0
   ```

## Technical Details

### Network

- **Cluster:** Solana Devnet
- **Commitment:** Confirmed

### Account Structure

The Counter account stores:

- `authority` (32 bytes): Public key of the counter owner
- `count` (8 bytes): 64-bit unsigned integer counter value
- `bump` (1 byte): PDA bump seed for address derivation

### PDA (Program Derived Address)

Each user gets exactly one counter account with an address derived from:
- Program ID
- Seed: `"counter"`
- User's public key

This ensures deterministic, unique counter addresses per user.

### Security

- Only the authority (creator) can increment their counter
- Anyone can read counter values
- All transactions require proper signatures

### Error Handling

The client provides clear error messages for:

- Missing counter addresses
- Invalid keypair files
- Transaction failures
- Network connectivity issues

## Development

### Running in Watch Mode

```bash
pnpm run dev
```

### Dependencies

- `@solana/web3.js`: Solana JavaScript SDK
- `tsx`: TypeScript execution engine
- `@types/node`: Node.js type definitions

## Troubleshooting

### "Counter not found"

- Verify the counter address is correct
- Ensure the counter was successfully initialized
- Check you're connected to the right network (devnet)

### "Transaction failed"

- Ensure your wallet has sufficient SOL for transaction fees
- Verify you're the authority for increment operations
- Check network connectivity

### "Keypair loading failed"

- Verify the keypair file path is correct
- Ensure the keypair file contains valid JSON array format
- Check file permissions

## Support

For issues or questions, refer to the main project repository.
