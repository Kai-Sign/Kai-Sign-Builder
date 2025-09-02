import os
import binascii
from typing import Tuple, Optional

from dotenv import load_dotenv

# AWS KMS and crypto utilities
import boto3
from botocore.config import Config as BotoConfig
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import load_der_public_key
from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature

from eth_utils import keccak, to_checksum_address
from eth_keys.datatypes import Signature
from eth_keys.backends.native.ecdsa import ecdsa_raw_recover


load_dotenv()


SECP256K1_N = int(
    "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141", 16
)


class KmsEthereumSigner:
    """Helper for using AWS KMS secp256k1 keys to sign Ethereum digests."""

    def __init__(self, key_id: str, region: Optional[str] = None):
        if not key_id:
            raise ValueError("KMS key id is required")
        region_name = region or os.getenv("AWS_REGION") or os.getenv("AWS_DEFAULT_REGION")
        if not region_name:
            raise ValueError("AWS region must be set in AWS_REGION or provided explicitly")
        self.key_id = key_id
        self.client = boto3.client(
            "kms",
            region_name=region_name,
            config=BotoConfig(retries={"max_attempts": 5, "mode": "standard"}),
        )

    def _get_uncompressed_pubkey(self) -> bytes:
        """
        Returns uncompressed public key bytes (0x04 || X || Y) from KMS.
        """
        resp = self.client.get_public_key(KeyId=self.key_id)
        der_bytes = resp["PublicKey"]
        pub = load_der_public_key(der_bytes)
        if not isinstance(pub, ec.EllipticCurvePublicKey):
            raise ValueError("KMS public key is not EC")
        numbers = pub.public_numbers()
        x = numbers.x.to_bytes(32, byteorder="big")
        y = numbers.y.to_bytes(32, byteorder="big")
        return b"\x04" + x + y

    def get_eth_address(self) -> str:
        uncompressed = self._get_uncompressed_pubkey()
        # Ethereum address = last 20 bytes of keccak(uncompressed[1:])
        addr_bytes = keccak(uncompressed[1:])[-20:]
        return to_checksum_address("0x" + addr_bytes.hex())

    @staticmethod
    def _ensure_low_s(r: int, s: int) -> Tuple[int, int, bool]:
        """
        Ensure low-s form. Returns (r, s, flipped) where flipped indicates if s was adjusted.
        """
        flipped = False
        if s > SECP256K1_N // 2:
            s = SECP256K1_N - s
            flipped = True
        return r, s, flipped

    def sign_digest(self, digest_hex: str) -> Tuple[int, int, int, int]:
        """
        Signs a 32-byte digest (keccak-256 of the payload). Returns (r, s, v, y_parity).
        - v is 27/28 per legacy Ethereum
        - y_parity is 0/1 per EIP-2718 typed txs
        """
        if digest_hex.startswith("0x"):
            digest_hex = digest_hex[2:]
        try:
            digest = binascii.unhexlify(digest_hex)
        except binascii.Error:
            raise ValueError("Invalid digest hex")
        if len(digest) != 32:
            raise ValueError("Digest must be 32 bytes")

        # Ask KMS to sign the digest. We use ECDSA_SHA_256 algorithm name, but pass raw digest.
        # KMS does not re-hash when MessageType='DIGEST'.
        resp = self.client.sign(
            KeyId=self.key_id,
            Message=digest,
            MessageType="DIGEST",
            SigningAlgorithm="ECDSA_SHA_256",
        )
        der_sig = resp["Signature"]

        r, s = decode_dss_signature(der_sig)
        r, s, flipped = self._ensure_low_s(r, s)

        # Determine recovery id by trial recovery against the KMS public key
        uncompressed = self._get_uncompressed_pubkey()
        pubkey_bytes = uncompressed[1:]  # 64 bytes X||Y
        pubkey_x = int.from_bytes(pubkey_bytes[:32], "big")
        pubkey_y = int.from_bytes(pubkey_bytes[32:], "big")

        # Try both recovery ids
        rec_id_found: Optional[int] = None
        for rec_id in (0, 1):
            try:
                recovered = ecdsa_raw_recover(digest, (r, s, rec_id))
                if recovered.point.x == pubkey_x and recovered.point.y == pubkey_y:
                    rec_id_found = rec_id
                    break
            except Exception:
                continue
        if rec_id_found is None:
            # Fallback heuristic: use parity from Y coordinate
            rec_id_found = pubkey_y & 1

        y_parity = rec_id_found
        v = 27 + rec_id_found
        return r, s, v, y_parity


