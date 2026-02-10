──────────────────────────────────────────────────────────────────────────────────────────────╮
│ > Only map what is in the metadata to the translation data.Do not make specific mappings       │
│   based on specific transaction data. 1 metadata covers 1 level of the transaction data, and   │
│   the first metadata will cover the highest level of the nest.The second metadata will cover   │
│   the second level of the nest.The third metadata will cover the third level of the nest.When  │
│   transactions are batched, Make a function to iterate each batch so it can cover the whole    │
│   Transaction data without specifying the amount of the batch.   