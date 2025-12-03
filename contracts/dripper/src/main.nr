use dep::aztec::macros::aztec;

#[aztec]
pub contract Dripper {
    use dep::aztec::macros::functions::{initializer, external};
    use dep::aztec::protocol_types::address::AztecAddress;
    use token::Token;

    #[external("public")]
    #[initializer]
    fn constructor() {}

    /// @notice Mints tokens into the public balance of the caller
    /// @dev Caller obtains `amount` tokens in their public balance
    /// @param token_address The address of the token contract
    /// @param amount The amount of tokens to mint (u64, converted to u128 internally)
    #[external("public")]
    fn drip_to_public(token_address: AztecAddress, amount: u64) {
        let msg_sender = context.msg_sender().unwrap();
        Token::at(token_address).mint_to_public(msg_sender, amount as u128).call(&mut context);
    }

    /// @notice Mints tokens into the private balance of the caller
    /// @dev Caller obtains `amount` tokens in their private balance
    /// @param token_address The address of the token contract
    /// @param amount The amount of tokens to mint (u64, converted to u128 internally)
    #[external("private")]
    fn drip_to_private(token_address: AztecAddress, amount: u64) {
        let msg_sender = context.msg_sender().unwrap();
        // Wonderland token mint_to_private signature: (to, amount)
        Token::at(token_address)
            .mint_to_private(msg_sender, amount as u128)
            .call(&mut context);
    }

}
