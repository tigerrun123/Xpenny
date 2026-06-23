export const OPENCLAW_INVOCATION_IDL = {
  address: "5SfS5maRBYUE3sEnfRX4xjNzRpPNhXPEsQjboCVKb41e",
  metadata: {
    name: "openclaw_invocation",
    version: "0.1.0",
    spec: "0.1.0"
  },
  version: "0.1.0",
  name: "openclaw_invocation",
  instructions: [
    {
      name: "registerAgent",
      discriminator: [135, 157, 66, 195, 2, 113, 175, 30],
      accounts: [
        { name: "agent", writable: true, signer: false },
        { name: "owner", writable: true, signer: true },
        { name: "systemProgram", writable: false, signer: false }
      ],
      args: [
        { name: "slug", type: "string" },
        { name: "manifestUri", type: "string" },
        { name: "manifestHash", type: { array: ["u8", 32] } },
        { name: "agentSigner", type: "pubkey" },
        { name: "priceLamports", type: "u64" }
      ]
    },
    {
      name: "updateAgent",
      discriminator: [85, 2, 178, 9, 119, 139, 102, 164],
      accounts: [
        { name: "agent", writable: true, signer: false },
        { name: "owner", writable: false, signer: true }
      ],
      args: [
        { name: "manifestUri", type: "string" },
        { name: "manifestHash", type: { array: ["u8", 32] } },
        { name: "agentSigner", type: "pubkey" },
        { name: "priceLamports", type: "u64" },
        { name: "active", type: "bool" }
      ]
    },
    {
      name: "createInvocation",
      discriminator: [116, 23, 146, 191, 178, 68, 64, 65],
      accounts: [
        { name: "agent", writable: true, signer: false },
        { name: "invocation", writable: true, signer: false },
        { name: "requester", writable: true, signer: true },
        { name: "systemProgram", writable: false, signer: false }
      ],
      args: [
        { name: "nonce", type: "u64" },
        { name: "inputHash", type: { array: ["u8", 32] } },
        { name: "inputUri", type: "string" }
      ]
    },
    {
      name: "completeInvocation",
      discriminator: [232, 203, 13, 30, 135, 199, 88, 0],
      accounts: [
        { name: "invocation", writable: true, signer: false },
        { name: "agent", writable: false, signer: false },
        { name: "agentSigner", writable: false, signer: true },
        { name: "agentOwner", writable: true, signer: false }
      ],
      args: [
        { name: "resultHash", type: { array: ["u8", 32] } },
        { name: "resultUri", type: "string" }
      ]
    },
    {
      name: "cancelInvocation",
      discriminator: [48, 240, 27, 77, 249, 148, 129, 61],
      accounts: [
        { name: "invocation", writable: true, signer: false },
        { name: "requester", writable: true, signer: true }
      ],
      args: []
    }
  ],
  accounts: [
    {
      name: "Agent",
      discriminator: [47, 166, 112, 147, 155, 197, 86, 7]
    },
    {
      name: "Invocation",
      discriminator: [206, 201, 229, 132, 106, 251, 110, 191]
    }
  ],
  types: [
    {
      name: "Agent",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "pubkey" },
          { name: "agentSigner", type: "pubkey" },
          { name: "slug", type: "string" },
          { name: "manifestUri", type: "string" },
          { name: "manifestHash", type: { array: ["u8", 32] } },
          { name: "priceLamports", type: "u64" },
          { name: "active", type: "bool" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "Invocation",
      type: {
        kind: "struct",
        fields: [
          { name: "agent", type: "pubkey" },
          { name: "requester", type: "pubkey" },
          { name: "inputHash", type: { array: ["u8", 32] } },
          { name: "inputUri", type: "string" },
          { name: "resultHash", type: { option: { array: ["u8", 32] } } },
          { name: "resultUri", type: "string" },
          {
            name: "status",
            type: {
              defined: "InvocationStatus"
            }
          },
          { name: "escrowLamports", type: "u64" },
          { name: "createdAt", type: "i64" },
          { name: "completedAt", type: { option: "i64" } },
          { name: "nonce", type: "u64" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "InvocationStatus",
      type: {
        kind: "enum",
        variants: [{ name: "Pending" }, { name: "Completed" }, { name: "Cancelled" }]
      }
    }
  ]
};
