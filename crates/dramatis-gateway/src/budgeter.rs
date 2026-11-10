use tiktoken_rs::cl100k_base;
use crate::types::ChatMessage;

pub struct ContextBudgeter {
    pub max_context_tokens: usize,
    pub reserved_response_tokens: usize,
}

impl ContextBudgeter {
    pub fn new(max_context_tokens: usize, reserved_response_tokens: usize) -> Self {
        Self {
            max_context_tokens,
            reserved_response_tokens,
        }
    }

    pub fn count_tokens(&self, text: &str) -> usize {
        let bpe = cl100k_base().expect("Failed to initialize tokenizer");
        bpe.encode_with_special_tokens(text).len()
    }

    pub fn count_messages_tokens(&self, messages: &[ChatMessage]) -> usize {
        messages.iter().map(|m| self.count_tokens(&m.content) + 4).sum()
    }

    pub fn available_prompt_tokens(&self) -> usize {
        if self.max_context_tokens > self.reserved_response_tokens {
            self.max_context_tokens - self.reserved_response_tokens
        } else {
            0
        }
    }

    pub fn prune_messages(&self, messages: &[ChatMessage]) -> Vec<ChatMessage> {
        let available = self.available_prompt_tokens();
        let mut total = 0;
        let mut result = Vec::new();

        for msg in messages.iter().rev() {
            let cost = self.count_tokens(&msg.content) + 4;
            if total + cost <= available {
                total += cost;
                result.push(msg.clone());
            } else {
                break;
            }
        }

        result.reverse();
        result
    }
}

