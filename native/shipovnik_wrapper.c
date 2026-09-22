#include "params.h"
#include "shipovnik.h"

#include <stddef.h>
#include <stdint.h>
#include <string.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define TC26_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define TC26_EXPORT
#endif

#define SHIPOVNIK_KEYPAIR_ENTROPY_BYTES (N * sizeof(uint32_t))
#define SHIPOVNIK_SIGN_ENTROPY_BYTES \
    (DELTA * (SHIPOVNIK_SECRETKEYBYTES + N * sizeof(uint32_t)))

static const uint8_t* entropy_bytes = NULL;
static size_t entropy_length = 0;
static size_t entropy_offset = 0;
static int entropy_exhausted = 0;

void randombytes(uint8_t* output, size_t output_length)
{
    if (entropy_bytes == NULL || output_length > entropy_length - entropy_offset) {
        memset(output, 0, output_length);
        entropy_exhausted = 1;
        return;
    }
    memcpy(output, entropy_bytes + entropy_offset, output_length);
    entropy_offset += output_length;
}

static void set_entropy(const uint8_t* entropy, size_t length)
{
    entropy_bytes = entropy;
    entropy_length = length;
    entropy_offset = 0;
    entropy_exhausted = 0;
}

TC26_EXPORT size_t tc26_shipovnik_public_key_bytes(void)
{
    return SHIPOVNIK_PUBLICKEYBYTES;
}

TC26_EXPORT size_t tc26_shipovnik_secret_key_bytes(void)
{
    return SHIPOVNIK_SECRETKEYBYTES;
}

TC26_EXPORT size_t tc26_shipovnik_signature_max_bytes(void)
{
    return SHIPOVNIK_SIGBYTES;
}

TC26_EXPORT size_t tc26_shipovnik_keypair_entropy_bytes(void)
{
    return SHIPOVNIK_KEYPAIR_ENTROPY_BYTES;
}

TC26_EXPORT size_t tc26_shipovnik_sign_entropy_bytes(void)
{
    return SHIPOVNIK_SIGN_ENTROPY_BYTES;
}

TC26_EXPORT int tc26_shipovnik_keypair(
    const uint8_t* entropy,
    size_t entropy_size,
    uint8_t* secret_key,
    uint8_t* public_key)
{
    set_entropy(entropy, entropy_size);
    shipovnik_generate_keys(secret_key, public_key);
    return entropy_exhausted ? 1 : 0;
}

TC26_EXPORT int tc26_shipovnik_sign(
    const uint8_t* entropy,
    size_t entropy_size,
    const uint8_t* secret_key,
    const uint8_t* message,
    size_t message_length,
    uint8_t* signature)
{
    size_t signature_length = 0;
    set_entropy(entropy, entropy_size);
    shipovnik_sign(secret_key, message, message_length, signature, &signature_length);
    if (entropy_exhausted || signature_length > INT32_MAX) {
        return -1;
    }
    return (int)signature_length;
}

TC26_EXPORT int tc26_shipovnik_verify(
    const uint8_t* public_key,
    const uint8_t* signature,
    const uint8_t* message,
    size_t message_length)
{
    return shipovnik_verify(public_key, signature, message, message_length);
}