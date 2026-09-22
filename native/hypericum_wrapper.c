#include "api.h"
#include "drbg.h"
#include "params.h"
#include "sign.h"

#include <stddef.h>
#include <stdint.h>

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define TC26_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define TC26_EXPORT
#endif

TC26_EXPORT size_t tc26_hypericum_public_key_bytes(void)
{
    return CRYPTO_PUBLICKEYBYTES;
}

TC26_EXPORT size_t tc26_hypericum_secret_key_bytes(void)
{
    return CRYPTO_SECRETKEYBYTES;
}

TC26_EXPORT size_t tc26_hypericum_signature_bytes(void)
{
    return CRYPTO_BYTES;
}

TC26_EXPORT size_t tc26_hypericum_seed_bytes(void)
{
    return DRBG_INIT_BYTES_LEN;
}

TC26_EXPORT void tc26_hypericum_seed(const uint8_t* entropy)
{
    randombytes_init((uint8_t*)entropy);
}

TC26_EXPORT int tc26_hypericum_keypair(uint8_t* public_key, uint8_t* secret_key)
{
    return crypto_sign_keypair(public_key, secret_key);
}

TC26_EXPORT int tc26_hypericum_sign(
    const uint8_t* secret_key,
    const uint8_t* message,
    size_t message_length,
    uint8_t* signature)
{
    return hypericum_sign(secret_key, message, message_length, signature);
}

TC26_EXPORT int tc26_hypericum_verify(
    const uint8_t* public_key,
    const uint8_t* signature,
    const uint8_t* message,
    size_t message_length)
{
    return hypericum_verify(public_key, signature, message, message_length);
}