/// Masks an API key for logging purposes.
/// Shows first 4 and last 4 characters, masks the rest.
pub fn mask_api_key(key: &str) -> String {
    if key.len() <= 8 {
        "****".to_string()
    } else {
        format!("{}****{}", &key[..4], &key[key.len() - 4..])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mask_api_key_short() {
        assert_eq!(mask_api_key("short"), "****");
    }

    #[test]
    fn test_mask_api_key_long() {
        assert_eq!(mask_api_key("sk-abcdefghij"), "sk-a****ghij");
    }

    #[test]
    fn test_mask_api_key_exactly_8() {
        assert_eq!(mask_api_key("abcdefgh"), "****");
    }
}
